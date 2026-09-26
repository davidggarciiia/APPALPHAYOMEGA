import { Injectable, Logger } from "@nestjs/common"
import {
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  resumenDeResultado,
  type EnviarEntrenamiento,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"
import { Prisma } from "@prisma/client"

import { AgendaService } from "../agenda/agenda.service.js"
import { CarreraPerdida, conflicto, esViolacionDeUnicidad } from "../comun/conflictos.js"
import { huellaDe } from "../comun/huella.js"
import { PrismaService } from "../prisma/prisma.service.js"

import {
  leerPropia,
  motivoDelConflicto,
  validarRegistro,
  type FilaDeEscritura,
} from "./borradores.service.js"
import { construirResultado } from "./resultado.js"

/**
 * «Enviar entrenamiento» (SPEC-entrenamiento.md, pasos 1 a 7).
 *
 * El resultado y el cierre de la sesión de agenda se confirman juntos o no se
 * confirma nada. Pulsar dos veces, perder la respuesta o reintentar a la vez
 * devuelven el mismo resultado sin registrarlo otra vez.
 */
@Injectable()
export class EnviosService {
  private readonly registro = new Logger(EnviosService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly agenda: AgendaService,
  ) {}

  async enviar(
    clienteId: string,
    id: string,
    datos: EnviarEntrenamiento,
  ): Promise<ResultadoEntrenamiento> {
    const huella = huellaDe({
      revisionPrescripcion: datos.revisionPrescripcion,
      revisionBorrador: datos.revisionBorrador,
      registro: datos.registro,
    })

    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const fila = await leerPropia(tx, clienteId, id)
        if (fila.enviadoEn !== null) {
          return this.repeticion(fila, datos.operacionId, huella)
        }
        if (
          fila.revisionPrescripcion !== datos.revisionPrescripcion ||
          fila.revisionBorrador !== datos.revisionBorrador
        ) {
          throw motivoDelConflicto(fila, datos.revisionPrescripcion, datos.revisionBorrador)
        }
        const registro = validarRegistro(fila, datos.registro)
        const enviadoEn = new Date()
        const resultado = construirResultado(
          id,
          PrescripcionSchema.parse(fila.prescripcion),
          fila.revisionPrescripcion,
          registro,
          enviadoEn,
        )

        // Primero la agenda (mismo orden de bloqueo que mover y anular).
        if (!(await this.agenda.cerrar(tx, id))) {
          throw new CarreraPerdida()
        }
        const { count } = await tx.sesionEntrenamiento.updateMany({
          where: {
            id,
            enviadoEn: null,
            revisionPrescripcion: datos.revisionPrescripcion,
            revisionBorrador: datos.revisionBorrador,
          },
          data: {
            resultado,
            enviadoEn,
            operacionEnvio: datos.operacionId,
            huellaEnvio: huella,
            // El borrador deja de existir: lo publicado es el resultado.
            borrador: Prisma.DbNull,
            iniciadaEn: fila.iniciadaEn ?? enviadoEn,
            ...resumenDeResultado(resultado),
          },
        })
        if (count !== 1) {
          // El rollback deshace también el cierre de la agenda.
          throw new CarreraPerdida()
        }
        return resultado
      })
      this.registro.log(`Sesion ${id} enviada`)
      return resultado
    } catch (error) {
      if (esViolacionDeUnicidad(error)) {
        throw conflicto("operacion_reutilizada", "Este envío ya se usó para otra sesión")
      }
      if (!(error instanceof CarreraPerdida)) {
        throw error
      }
      const despues = await leerPropia(this.prisma, clienteId, id)
      if (despues.enviadoEn !== null) {
        // Doble toque o reintento simultáneo: el otro confirmó primero.
        return this.repeticion(despues, datos.operacionId, huella)
      }
      throw motivoDelConflicto(despues, datos.revisionPrescripcion, datos.revisionBorrador)
    }
  }

  private repeticion(
    fila: FilaDeEscritura,
    operacionId: string,
    huella: string,
  ): ResultadoEntrenamiento {
    if (fila.operacionEnvio !== operacionId) {
      throw conflicto("sesion_enviada", "Este entrenamiento ya se había enviado")
    }
    if (fila.huellaEnvio !== huella) {
      throw conflicto("operacion_reutilizada", "Este envío ya se hizo con otro contenido")
    }
    return ResultadoEntrenamientoSchema.parse(fila.resultado)
  }
}
