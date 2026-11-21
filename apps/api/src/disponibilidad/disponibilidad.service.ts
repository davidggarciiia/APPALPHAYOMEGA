import { Injectable, NotFoundException } from "@nestjs/common"
import type { HuecoDisponibilidad as FilaHueco } from "@prisma/client"
import {
  HuecoDisponibilidadSchema,
  FechaAgendaSchema,
  type AbrirHuecos,
  type ConsultarHuecos,
  type HuecoDisponibilidad,
  type ListadoHuecos,
} from "@alpha-omega/shared"
import { fechaSql, sumarDias } from "../agenda/fechas.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { inicioEnMadrid } from "./horario.js"
import { conflicto, invalida } from "../entrenamiento/documentos.js"

function publico(fila: FilaHueco): HuecoDisponibilidad {
  return HuecoDisponibilidadSchema.parse({
    id: fila.id,
    entrenadorId: fila.entrenadorId,
    fecha: fila.fecha.toISOString().slice(0, 10),
    horaInicio: fila.horaInicio,
    inicioEn: fila.inicioEn.toISOString(),
    finEn: fila.finEn.toISOString(),
    duracionMinutos: fila.duracionMinutos,
    servicios: fila.servicios,
    estado: fila.estado,
    creadoEn: fila.creadoEn.toISOString(),
    cerradoEn: fila.cerradoEn?.toISOString() ?? null,
  })
}

@Injectable()
export class DisponibilidadService {
  constructor(private readonly prisma: PrismaService) {}

  async abrir(actor: IdentidadVerificada, datos: AbrirHuecos): Promise<ListadoHuecos> {
    const peticion = { ...datos, servicios: [...datos.servicios].sort() }
    const huecos = Array.from({ length: datos.semanas }, (_, indice) => {
      const fecha = sumarDias(datos.fecha, indice * 7)
      if (!FechaAgendaSchema.safeParse(fecha).success)
        throw invalida("Las repeticiones exceden el rango de fechas permitido")
      const inicioEn = inicioEnMadrid(fecha, datos.horaInicio)
      const finEn = new Date(inicioEn.getTime() + datos.duracionMinutos * 60_000)
      if (inicioEn.getUTCFullYear() < 1 || finEn.getUTCFullYear() > 9999)
        throw invalida("El horario excede el rango de fechas permitido")
      return {
        fecha: fechaSql(fecha),
        horaInicio: datos.horaInicio,
        inicioEn,
        finEn,
        duracionMinutos: datos.duracionMinutos,
        servicios: peticion.servicios,
      }
    })
    return this.prisma.$transaction(async (tx) => {
      // Todas las aperturas de un entrenador comparten candado, incluidos los solapes.
      await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${actor.sub} FOR UPDATE`
      const anterior = await tx.aperturaDisponibilidad.findUnique({
        where: {
          entrenadorId_operacionId: { entrenadorId: actor.sub, operacionId: datos.operacionId },
        },
        include: { huecos: { orderBy: [{ inicioEn: "asc" }, { id: "asc" }] } },
      })
      if (anterior) {
        // JSONB no conserva el orden de las claves; se compara el contrato normalizado.
        const previa = anterior.peticion as AbrirHuecos
        if (
          previa.fecha !== peticion.fecha ||
          previa.horaInicio !== peticion.horaInicio ||
          previa.duracionMinutos !== peticion.duracionMinutos ||
          previa.semanas !== peticion.semanas ||
          JSON.stringify(previa.servicios) !== JSON.stringify(peticion.servicios)
        )
          throw conflicto(
            "operacion_incompatible",
            "Esta operación ya se usó para abrir otros huecos",
          )
        return { huecos: anterior.huecos.map(publico), total: anterior.huecos.length }
      }
      for (const hueco of huecos) {
        const solape = await tx.huecoDisponibilidad.findFirst({
          where: {
            entrenadorId: actor.sub,
            estado: { not: "cerrado" },
            inicioEn: { lt: hueco.finEn },
            finEn: { gt: hueco.inicioEn },
          },
          select: { id: true },
        })
        if (solape)
          throw conflicto(
            "estado_incompatible",
            "Ya tienes un hueco abierto o reservado en ese horario",
          )
      }
      const apertura = await tx.aperturaDisponibilidad.create({
        data: {
          entrenadorId: actor.sub,
          operacionId: datos.operacionId,
          peticion,
          huecos: { create: huecos.map((hueco) => ({ ...hueco, entrenadorId: actor.sub })) },
        },
        include: { huecos: { orderBy: [{ inicioEn: "asc" }, { id: "asc" }] } },
      })
      return { huecos: apertura.huecos.map(publico), total: apertura.huecos.length }
    })
  }

  async listar(actor: IdentidadVerificada, consulta: ConsultarHuecos): Promise<ListadoHuecos> {
    const where = {
      entrenadorId: actor.sub,
      fecha: { gte: fechaSql(consulta.desde), lte: fechaSql(consulta.hasta) },
    }
    const [huecos, total] = await this.prisma.$transaction([
      this.prisma.huecoDisponibilidad.findMany({
        where,
        orderBy: [{ inicioEn: "asc" }, { id: "asc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      }),
      this.prisma.huecoDisponibilidad.count({ where }),
    ])
    return { huecos: huecos.map(publico), total }
  }

  async cerrar(actor: IdentidadVerificada, id: string): Promise<HuecoDisponibilidad> {
    return this.prisma.$transaction(async (tx) => {
      // Reservar en R3 debe tomar este mismo candado antes de reclamar el hueco libre.
      await tx.$queryRaw`SELECT "id" FROM "huecos_disponibilidad" WHERE "id" = ${id} AND "entrenadorId" = ${actor.sub} FOR UPDATE`
      const hueco = await tx.huecoDisponibilidad.findFirst({
        where: { id, entrenadorId: actor.sub },
      })
      if (!hueco) throw new NotFoundException("Hueco no encontrado")
      if (hueco.estado === "reservado")
        throw conflicto(
          "estado_incompatible",
          "El hueco está reservado; cancela primero la reserva",
        )
      if (hueco.estado === "cerrado") return publico(hueco)
      return publico(
        await tx.huecoDisponibilidad.update({
          where: { id },
          data: { estado: "cerrado", cerradoEn: new Date() },
        }),
      )
    })
  }
}
