import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@prisma/client"
import {
  AvisoReservaSchema,
  ReservaSchema,
  type AsignarReserva,
  type AvisoReserva,
  type CancelarReserva,
  type ConsultarAvisosReserva,
  type ConsultarReservas,
  type ListadoAvisosReserva,
  type ListadoReservas,
  type MarcarAsistenciaReserva,
  type Reserva,
} from "@alpha-omega/shared"
import { fechaSql } from "../agenda/fechas.js"
import { BonosService } from "../bonos/bonos.service.js"
import { conflicto, esCodigoPrisma } from "../entrenamiento/documentos.js"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

type FilaReserva = Prisma.ReservaGetPayload<{ include: { hueco: true } }>
type FilaAviso = Prisma.AvisoReservaGetPayload<{
  include: { reserva: { include: { hueco: true } } }
}>
function publica(fila: FilaReserva): Reserva {
  return ReservaSchema.parse({
    id: fila.id,
    huecoId: fila.huecoId,
    clienteId: fila.clienteId,
    entrenadorId: fila.entrenadorId,
    servicio: fila.servicio,
    fecha: fila.hueco.fecha.toISOString().slice(0, 10),
    horaInicio: fila.hueco.horaInicio,
    inicioEn: fila.hueco.inicioEn.toISOString(),
    finEn: fila.hueco.finEn.toISOString(),
    duracionMinutos: fila.hueco.duracionMinutos,
    cantidadConsumida: fila.cantidadConsumida,
    mesCupo: fila.mesCupo,
    estado: fila.estado,
    creadaEn: fila.creadaEn.toISOString(),
    canceladaEn: fila.canceladaEn?.toISOString() ?? null,
    devuelto: fila.devuelto,
    asistio: fila.asistio,
    asistenciaEn: fila.asistenciaEn?.toISOString() ?? null,
  })
}
function avisoPublico(fila: FilaAviso): AvisoReserva {
  return AvisoReservaSchema.parse({
    id: fila.id,
    reservaId: fila.reservaId,
    clienteId: fila.reserva.clienteId,
    tipo: fila.tipo,
    servicio: fila.reserva.servicio,
    fecha: fila.reserva.hueco.fecha.toISOString().slice(0, 10),
    horaInicio: fila.reserva.hueco.horaInicio,
    duracionMinutos: fila.reserva.hueco.duracionMinutos,
    creadaEn: fila.creadaEn.toISOString(),
    leidaEn: fila.leidaEn?.toISOString() ?? null,
  })
}

@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bonos: BonosService,
    private readonly alcance: AlcanceClienteService,
  ) {}

  private entrenador(actor: IdentidadVerificada): void {
    if (actor.rol !== "entrenador") throw new ForbiddenException()
  }
  private async cliente(actor: IdentidadVerificada, clienteId: string): Promise<void> {
    if (actor.rol !== "cliente" && actor.rol !== "entrenador") throw new ForbiddenException()
    if (
      !(await this.alcance.puedeAcceder(actor, clienteId)) ||
      !(await this.prisma.usuario.findFirst({
        where: { id: clienteId, rol: "cliente" },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Reservas no disponibles")
  }
  private repetir(fila: FilaReserva, datos: AsignarReserva): Reserva {
    if (
      fila.huecoId !== datos.huecoId ||
      fila.clienteId !== datos.clienteId ||
      fila.servicio !== datos.servicio
    )
      throw conflicto("operacion_incompatible", "Esta operación ya se usó para otra reserva")
    return publica(fila)
  }

  async asignar(actor: IdentidadVerificada, datos: AsignarReserva): Promise<Reserva> {
    this.entrenador(actor)
    const clave = { entrenadorId: actor.sub, operacionId: datos.operacionId }
    try {
      return await this.prisma.$transaction(async (tx) => {
        // El cierre y cualquier asignación usan el mismo candado, antes del saldo.
        await tx.$queryRaw`SELECT "id" FROM "huecos_disponibilidad" WHERE "id" = ${datos.huecoId} AND "entrenadorId" = ${actor.sub} FOR UPDATE`
        const anterior = await tx.reserva.findUnique({
          where: { entrenadorId_operacionId: clave },
          include: { hueco: true },
        })
        if (anterior) return this.repetir(anterior, datos)
        const hueco = await tx.huecoDisponibilidad.findFirst({
          where: { id: datos.huecoId, entrenadorId: actor.sub },
        })
        if (!hueco) throw new NotFoundException("Hueco no encontrado")
        if (hueco.estado !== "libre")
          throw conflicto("estado_incompatible", "El hueco ya no está libre")
        if (!hueco.servicios.includes(datos.servicio))
          throw conflicto("estado_incompatible", "El hueco no admite este servicio")
        const mes = hueco.fecha.toISOString().slice(0, 7)
        const saldo = await this.bonos.prepararReserva(tx, actor, datos.clienteId, mes)
        const cantidad = datos.servicio === "entrenoPersonal" ? 1 : hueco.duracionMinutos
        if (datos.servicio === "entrenoPersonal" && saldo.saldos[0]!.creditos < cantidad)
          throw conflicto(
            "estado_incompatible",
            "El cliente no tiene créditos suficientes de entreno personal",
          )
        if (datos.servicio === "seguimiento" && !saldo.seguimiento.activo)
          throw conflicto("estado_incompatible", "El cliente no tiene seguimiento activo")
        if (datos.servicio === "seguimiento" && saldo.seguimiento.minutosDisponibles < cantidad)
          throw conflicto(
            "estado_incompatible",
            "El cliente no tiene minutos suficientes en el cupo del mes de la cita",
          )
        const mesCupo = datos.servicio === "seguimiento" ? mes : null
        const consumo = await tx.movimientoBono.create({
          data: {
            clienteId: datos.clienteId,
            autorId: actor.sub,
            servicio: datos.servicio,
            tipo: "consumo",
            cantidad: -cantidad,
            mes: mesCupo,
            nota: `Reserva del ${hueco.fecha.toISOString().slice(0, 10)} a las ${hueco.horaInicio}`,
          },
        })
        const reserva = await tx.reserva.create({
          data: {
            ...datos,
            entrenadorId: actor.sub,
            cantidadConsumida: cantidad,
            mesCupo,
            consumoId: consumo.id,
            avisos: { create: { tipo: "asignada" } },
          },
          include: { hueco: true },
        })
        await tx.huecoDisponibilidad.update({
          where: { id: hueco.id },
          data: { estado: "reservado" },
        })
        return publica(reserva)
      })
    } catch (error) {
      // Una clave puede competir entre huecos diferentes; el índice revierte todo el perdedor.
      if (esCodigoPrisma(error, "P2002")) {
        const anterior = await this.prisma.reserva.findUnique({
          where: { entrenadorId_operacionId: clave },
          include: { hueco: true },
        })
        if (anterior) return this.repetir(anterior, datos)
        throw conflicto("estado_incompatible", "El hueco ya está reservado")
      }
      throw error
    }
  }

  private async bloquearReserva(
    tx: Prisma.TransactionClient,
    actor: IdentidadVerificada,
    id: string,
  ): Promise<FilaReserva> {
    const referencia = await tx.reserva.findFirst({
      where: { id, entrenadorId: actor.sub },
      select: { huecoId: true },
    })
    if (!referencia) throw new NotFoundException("Reserva no encontrada")
    await tx.$queryRaw`SELECT "id" FROM "huecos_disponibilidad" WHERE "id" = ${referencia.huecoId} FOR UPDATE`
    return tx.reserva.findUniqueOrThrow({ where: { id }, include: { hueco: true } })
  }
  async cancelar(actor: IdentidadVerificada, id: string, datos: CancelarReserva): Promise<Reserva> {
    this.entrenador(actor)
    return this.prisma.$transaction(async (tx) => {
      const reserva = await this.bloquearReserva(tx, actor, id)
      if (reserva.estado === "cancelada") {
        if (reserva.devuelto !== datos.devolver)
          throw conflicto(
            "operacion_incompatible",
            "La cancelación ya tiene otra decisión de devolución",
          )
        return publica(reserva)
      }
      // Se devuelve al mismo mes consumido, incluso si el cliente se dio de baja.
      await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${reserva.clienteId} FOR UPDATE`
      const devolucion = datos.devolver
        ? await tx.movimientoBono.create({
            data: {
              clienteId: reserva.clienteId,
              autorId: actor.sub,
              servicio: reserva.servicio,
              tipo: "devolucion",
              cantidad: reserva.cantidadConsumida,
              mes: reserva.mesCupo,
              nota: "Devolución por cancelación de reserva",
            },
          })
        : null
      const actual = await tx.reserva.update({
        where: { id },
        data: {
          estado: "cancelada",
          canceladaEn: new Date(),
          devuelto: datos.devolver,
          devolucionId: devolucion?.id ?? null,
          avisos: { create: { tipo: "cancelada" } },
        },
        include: { hueco: true },
      })
      await tx.huecoDisponibilidad.update({
        where: { id: reserva.huecoId },
        data: { estado: "libre" },
      })
      return publica(actual)
    })
  }
  async asistencia(
    actor: IdentidadVerificada,
    id: string,
    datos: MarcarAsistenciaReserva,
  ): Promise<Reserva> {
    this.entrenador(actor)
    return this.prisma.$transaction(async (tx) => {
      const reserva = await this.bloquearReserva(tx, actor, id)
      if (reserva.estado === "cancelada")
        throw conflicto("estado_incompatible", "La reserva está cancelada")
      if (reserva.asistio === datos.asistio) return publica(reserva)
      return publica(
        await tx.reserva.update({
          where: { id },
          data: { asistio: datos.asistio, asistenciaEn: new Date() },
          include: { hueco: true },
        }),
      )
    })
  }
  async agenda(actor: IdentidadVerificada, consulta: ConsultarReservas): Promise<ListadoReservas> {
    this.entrenador(actor)
    return this.listar({ entrenadorId: actor.sub }, consulta)
  }
  async deCliente(
    actor: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarReservas,
  ): Promise<ListadoReservas> {
    await this.cliente(actor, clienteId)
    return this.listar({ clienteId }, consulta)
  }
  private async listar(
    filtro: Prisma.ReservaWhereInput,
    consulta: ConsultarReservas,
  ): Promise<ListadoReservas> {
    const where = {
      ...filtro,
      hueco: { fecha: { gte: fechaSql(consulta.desde), lte: fechaSql(consulta.hasta) } },
    }
    const [reservas, total] = await this.prisma.$transaction([
      this.prisma.reserva.findMany({
        where,
        include: { hueco: true },
        orderBy: [{ hueco: { inicioEn: "asc" } }, { id: "asc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      }),
      this.prisma.reserva.count({ where }),
    ])
    return { reservas: reservas.map(publica), total }
  }
  async avisos(
    actor: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarAvisosReserva,
  ): Promise<ListadoAvisosReserva> {
    await this.cliente(actor, clienteId)
    const where = { reserva: { clienteId } }
    const [avisos, total, sinLeer] = await this.prisma.$transaction([
      this.prisma.avisoReserva.findMany({
        where,
        include: { reserva: { include: { hueco: true } } },
        orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      }),
      this.prisma.avisoReserva.count({ where }),
      this.prisma.avisoReserva.count({ where: { ...where, leidaEn: null } }),
    ])
    return { avisos: avisos.map(avisoPublico), total, sinLeer }
  }
  async leerAviso(actor: IdentidadVerificada, id: string): Promise<AvisoReserva> {
    if (actor.rol !== "cliente") throw new ForbiddenException()
    return this.prisma.$transaction(async (tx) => {
      const where = { id, reserva: { clienteId: actor.sub } }
      const aviso = await tx.avisoReserva.findFirst({ where, select: { id: true } })
      if (!aviso) throw new NotFoundException("Aviso no encontrado")
      await tx.avisoReserva.updateMany({
        where: { ...where, leidaEn: null },
        data: { leidaEn: new Date() },
      })
      return avisoPublico(
        await tx.avisoReserva.findUniqueOrThrow({
          where: { id },
          include: { reserva: { include: { hueco: true } } },
        }),
      )
    })
  }
}
