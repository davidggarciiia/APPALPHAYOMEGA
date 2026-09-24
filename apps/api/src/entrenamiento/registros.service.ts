import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import {
  BorradorSchema,
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  crearRegistroDeSesionSchema,
  type Borrador,
  type EnviarEntrenamiento,
  type GuardarBorrador,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"
import { PrismaService } from "../prisma/prisma.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import { AgendaService } from "../agenda/agenda.service.js"
import { SesionesService, type FilaSesion } from "./sesiones.service.js"
import { conflicto, hashPeticion, invalida, leerDocumento } from "./documentos.js"
import { registrarNovedad } from "./novedades.js"

@Injectable()
export class RegistrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
    private readonly agenda: AgendaService,
    private readonly consentimiento: ConsentimientoService,
  ) {}

  private async comprobarCuentaActiva(
    tx: Prisma.TransactionClient,
    clienteId: string,
  ): Promise<void> {
    const filas = await tx.$queryRaw<
      Array<{ rol: string; estado: string }>
    >`SELECT "rol", "estado" FROM "usuarios" WHERE "id" = ${clienteId} FOR SHARE`
    if (filas[0]?.rol !== "cliente" || filas[0]?.estado !== "activo")
      throw new UnauthorizedException("La cuenta ya no está activa")
  }

  private validar(fila: FilaSesion, datos: GuardarBorrador): void {
    if (fila.enviadoEn !== null)
      throw conflicto("operacion_incompatible", "El entrenamiento ya se ha enviado")
    if (
      fila.revisionPrescripcion !== datos.revisionPrescripcion ||
      fila.revisionBorrador !== datos.revisionBorrador
    )
      throw conflicto(
        "revision_obsoleta",
        "La sesión ha cambiado en otro dispositivo. Conserva tu copia y recupera la versión actual.",
      )
    const prescripcion = leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version)
    if (!crearRegistroDeSesionSchema(prescripcion).safeParse(datos.registro).success)
      throw invalida("Revisa las series, sus unidades y los valores de las series hechas")
  }

  async leerBorrador(identidad: IdentidadVerificada, id: string): Promise<Borrador | null> {
    const fila = await this.sesiones.fila(this.prisma, identidad, id, true)
    return fila.borrador === null
      ? null
      : leerDocumento(fila.borrador, BorradorSchema, fila.version)
  }

  async guardar(
    identidad: IdentidadVerificada,
    id: string,
    datos: GuardarBorrador,
  ): Promise<Borrador> {
    return this.prisma.$transaction(async (tx) => {
      const fila = await this.sesiones.bloquear(tx, identidad, id, true)
      // Incluso un replay de borrador queda rechazado tras el envío definitivo.
      if (fila.enviadoEn !== null)
        throw conflicto("operacion_incompatible", "El entrenamiento ya se ha enviado")
      const hash = hashPeticion(datos)
      const anterior = await tx.operacionEntrenamiento.findUnique({
        where: { sesionId_operacionId: { sesionId: id, operacionId: datos.operacionId } },
      })
      if (anterior) {
        if (anterior.tipo !== "borrador" || anterior.hashPeticion !== hash)
          throw conflicto("operacion_incompatible", "La operación ya se utilizó con otro contenido")
        return leerDocumento(anterior.respuesta, BorradorSchema, anterior.version)
      }
      await this.consentimiento.exigirVigente(fila.clienteId, identidad.sub, tx)
      this.validar(fila, datos)
      await this.comprobarCuentaActiva(tx, fila.clienteId)
      const respuesta = BorradorSchema.parse({
        revision: fila.revisionBorrador + 1,
        revisionPrescripcion: fila.revisionPrescripcion,
        registro: datos.registro,
        actualizadoEn: new Date().toISOString(),
      })
      await tx.sesionEntrenamiento.update({
        where: { id },
        data: { iniciada: true, revisionBorrador: respuesta.revision, borrador: respuesta },
      })
      await tx.operacionEntrenamiento.create({
        data: {
          sesionId: id,
          operacionId: datos.operacionId,
          tipo: "borrador",
          hashPeticion: hash,
          respuesta,
        },
      })
      return respuesta
    })
  }

  async resultado(identidad: IdentidadVerificada, id: string): Promise<ResultadoEntrenamiento> {
    const fila = await this.sesiones.fila(this.prisma, identidad, id)
    if (fila.resultado === null)
      throw new NotFoundException("Todavía no se ha enviado este entrenamiento")
    return leerDocumento(fila.resultado, ResultadoEntrenamientoSchema, fila.version)
  }

  async enviar(
    identidad: IdentidadVerificada,
    id: string,
    datos: EnviarEntrenamiento,
  ): Promise<ResultadoEntrenamiento> {
    return this.prisma.$transaction(async (tx) => {
      const fila = await this.sesiones.bloquear(tx, identidad, id, true)
      const hash = hashPeticion(datos)
      const anterior = await tx.operacionEntrenamiento.findUnique({
        where: { sesionId_operacionId: { sesionId: id, operacionId: datos.operacionId } },
      })
      if (anterior) {
        if (anterior.tipo !== "envio" || anterior.hashPeticion !== hash)
          throw conflicto("operacion_incompatible", "La operación ya se utilizó con otro contenido")
        return leerDocumento(anterior.respuesta, ResultadoEntrenamientoSchema, anterior.version)
      }
      await this.consentimiento.exigirVigente(fila.clienteId, identidad.sub, tx)
      this.validar(fila, datos)
      await this.comprobarCuentaActiva(tx, fila.clienteId)
      const prescripcion = leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version)
      const registradas = new Map(datos.registro.series.map((s) => [s.serieId, s]))
      const respuesta = ResultadoEntrenamientoSchema.parse({
        sesionId: id,
        prescripcion,
        revisionPrescripcion: fila.revisionPrescripcion,
        enviadoEn: new Date().toISOString(),
        notas: datos.registro.notas,
        checkin: datos.registro.checkin ?? null,
        cierre: datos.registro.cierre ?? null,
        inicio: datos.registro.inicio ?? null,
        tiempoActivoSegundos: datos.registro.tiempoActivoSegundos,
        series: prescripcion.ejercicios.flatMap((e) =>
          e.series.map((objetivo) => {
            const real = registradas.get(objetivo.id)
            if (!real?.hecha)
              return { serieId: objetivo.id, hecha: false, ...(real?.omitida && { omitida: true }) }
            return {
              serieId: objetivo.id,
              hecha: true,
              valores: {
                tipoMedicion: real.tipoMedicion,
                pesoKg: real.pesoKg,
                rir: real.rir ?? null,
                ...(real.tipoMedicion === "tiempo"
                  ? { segundos: real.segundos }
                  : { repeticiones: real.repeticiones }),
              },
            }
          }),
        ),
      })
      await tx.sesionEntrenamiento.update({
        where: { id },
        data: {
          iniciada: true,
          resultado: respuesta,
          enviadoEn: new Date(respuesta.enviadoEn),
          borrador: Prisma.DbNull,
        },
      })
      await this.agenda.cerrar(tx, id)
      await registrarNovedad(tx, {
        sesionId: id,
        clienteId: fila.clienteId,
        autorId: identidad.sub,
        audiencia: "entrenador",
        tipo: "entrenamiento_enviado",
      })
      await tx.operacionEntrenamiento.deleteMany({ where: { sesionId: id, tipo: "borrador" } })
      await tx.operacionEntrenamiento.create({
        data: {
          sesionId: id,
          operacionId: datos.operacionId,
          tipo: "envio",
          hashPeticion: hash,
          respuesta,
        },
      })
      return respuesta
    })
  }
}
