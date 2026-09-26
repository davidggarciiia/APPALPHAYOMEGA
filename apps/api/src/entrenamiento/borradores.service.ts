import { BadRequestException, Injectable } from "@nestjs/common"
import {
  PrescripcionSchema,
  crearRegistroDeSesionSchema,
  type Borrador,
  type GuardarBorrador,
  type Registro,
  type RespuestaBorrador,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { conflicto } from "../comun/conflictos.js"
import { huellaDe } from "../comun/huella.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { aBorrador, noExiste } from "./sesiones.service.js"

/** Lo que hace falta para decidir sobre un borrador o un envío. */
export const CAMPOS_DE_ESCRITURA = {
  id: true,
  prescripcion: true,
  revisionPrescripcion: true,
  borrador: true,
  revisionBorrador: true,
  borradorActualizadoEn: true,
  operacionBorrador: true,
  huellaBorrador: true,
  iniciadaEn: true,
  resultado: true,
  enviadoEn: true,
  operacionEnvio: true,
  huellaEnvio: true,
  agenda: { select: { clienteId: true } },
} as const

export type FilaDeEscritura = Prisma.SesionEntrenamientoGetPayload<{
  select: typeof CAMPOS_DE_ESCRITURA
}>

type Lector = Pick<Prisma.TransactionClient, "sesionEntrenamiento">

/** La sesión si es de quien pregunta. Si no, lo mismo que si no existiera. */
export async function leerPropia(
  cliente: Lector,
  clienteId: string,
  id: string,
): Promise<FilaDeEscritura> {
  const fila = await cliente.sesionEntrenamiento.findUnique({
    where: { id },
    select: CAMPOS_DE_ESCRITURA,
  })
  if (fila === null || fila.agenda.clienteId !== clienteId) {
    throw noExiste()
  }
  return fila
}

/** Valida el registro contra la prescripción que el servidor tiene de esa sesión. */
export function validarRegistro(fila: FilaDeEscritura, registro: Registro): Registro {
  const esquema = crearRegistroDeSesionSchema(PrescripcionSchema.parse(fila.prescripcion))
  const resultado = esquema.safeParse(registro)
  if (!resultado.success) {
    throw new BadRequestException({
      mensaje: "Hay series que no corresponden a esta sesión o les falta un dato",
      campos: [...new Set(resultado.error.issues.map((p) => p.path.join(".")))],
    })
  }
  return resultado.data
}

/** El motivo exacto por el que una escritura condicional no tocó la fila. */
export function motivoDelConflicto(
  fila: FilaDeEscritura,
  revisionPrescripcion: number,
  revisionBorrador: number,
): Error {
  if (fila.enviadoEn !== null) {
    return conflicto("sesion_enviada", "Este entrenamiento ya se ha enviado")
  }
  if (fila.revisionPrescripcion !== revisionPrescripcion) {
    return conflicto(
      "prescripcion_cambiada",
      "Tu entrenador ha cambiado esta sesión. Vuelve a cargarla",
      { revisionPrescripcion: fila.revisionPrescripcion },
    )
  }
  if (fila.revisionBorrador !== revisionBorrador) {
    return conflicto(
      "borrador_cambiado",
      "Hay una versión más reciente guardada desde otro dispositivo",
      { revisionBorrador: fila.revisionBorrador },
    )
  }
  return conflicto("borrador_cambiado", "El borrador ha cambiado. Vuelve a cargarlo")
}

/**
 * El borrador privado del cliente (SPEC-entrenamiento.md, «Borrador y recuperación»).
 *
 * Solo lo toca su dueño. Cada guardado lleva la revisión que conoce el móvil:
 * si otro dispositivo guardó entre medias, o el entrenador cambió la sesión, no
 * se pisa nada y se responde 409 con el motivo.
 */
@Injectable()
export class BorradoresService {
  constructor(private readonly prisma: PrismaService) {}

  async leer(clienteId: string, id: string): Promise<RespuestaBorrador> {
    const fila = await leerPropia(this.prisma, clienteId, id)
    return { borrador: aBorrador(fila) }
  }

  async guardar(clienteId: string, id: string, datos: GuardarBorrador): Promise<Borrador> {
    const huella = huellaDe({
      revisionPrescripcion: datos.revisionPrescripcion,
      revisionBorrador: datos.revisionBorrador,
      registro: datos.registro,
    })
    const fila = await leerPropia(this.prisma, clienteId, id)
    const repetida = this.repeticion(fila, datos.operacionId, huella)
    if (repetida !== null) {
      return repetida
    }
    if (
      fila.enviadoEn !== null ||
      fila.revisionPrescripcion !== datos.revisionPrescripcion ||
      fila.revisionBorrador !== datos.revisionBorrador
    ) {
      throw motivoDelConflicto(fila, datos.revisionPrescripcion, datos.revisionBorrador)
    }
    const registro = validarRegistro(fila, datos.registro)

    const ahora = new Date()
    const { count } = await this.prisma.sesionEntrenamiento.updateMany({
      where: {
        id,
        enviadoEn: null,
        revisionPrescripcion: datos.revisionPrescripcion,
        revisionBorrador: datos.revisionBorrador,
      },
      data: {
        borrador: registro,
        revisionBorrador: datos.revisionBorrador + 1,
        borradorActualizadoEn: ahora,
        operacionBorrador: datos.operacionId,
        huellaBorrador: huella,
        // Seguro: el WHERE fija la revisión, y con ella si ya estaba iniciada.
        iniciadaEn: fila.iniciadaEn ?? ahora,
      },
    })
    if (count === 1) {
      return {
        revision: datos.revisionBorrador + 1,
        revisionPrescripcion: datos.revisionPrescripcion,
        registro,
        actualizadoEn: ahora.toISOString(),
      }
    }

    // Perdió una carrera. Puede ser su propio reintento, que ganó un instante antes.
    const despues = await leerPropia(this.prisma, clienteId, id)
    const repeticionTardia = this.repeticion(despues, datos.operacionId, huella)
    if (repeticionTardia !== null) {
      return repeticionTardia
    }
    throw motivoDelConflicto(despues, datos.revisionPrescripcion, datos.revisionBorrador)
  }

  /**
   * Un reintento de la última operación aplicada devuelve el borrador vigente,
   * que es justo el de esa operación. El mismo id con otro contenido es 409.
   */
  private repeticion(fila: FilaDeEscritura, operacionId: string, huella: string): Borrador | null {
    if (fila.operacionBorrador !== operacionId) {
      return null
    }
    if (fila.huellaBorrador !== huella) {
      throw conflicto("operacion_reutilizada", "Este guardado ya se hizo con otro contenido")
    }
    if (fila.enviadoEn !== null) {
      throw conflicto("sesion_enviada", "Este entrenamiento ya se ha enviado")
    }
    return aBorrador(fila)
  }
}
