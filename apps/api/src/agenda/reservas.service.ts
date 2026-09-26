import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import {
  Prisma,
  type AjustesAgenda as FilaAjustes,
  type Servicio as FilaServicio,
} from "@prisma/client"
import {
  aInstante,
  calcularHuecos,
  horaDeMinutos,
  partesLocales,
  ReservaSchema,
  ServicioSchema,
  sumarDiasFecha,
  ZONA_AGENDA,
  type AjustesAgenda,
  type ConsultarDisponibilidad,
  type ConsultarReservas,
  type Disponibilidad,
  type ListadoReservas,
  type ListadoServicios,
  type MisReservas,
  type MoverReserva,
  type Reserva,
  type Reservar,
  type Servicio,
  type Tramo,
} from "@alpha-omega/shared"

import { conflicto, invalida } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { CobrosService } from "../planes/cobros.service.js"
import { SaldoService } from "../planes/saldo.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

type Tx = Prisma.TransactionClient

const MS_MINUTO = 60_000
const MS_HORA = 3_600_000
const MS_DIA = 86_400_000

const incluirReserva = {
  servicio: { select: { id: true, codigo: true, nombre: true, duracionMin: true } },
  cliente: { select: { id: true, nombre: true, apellidos: true } },
} as const
type FilaReserva = Prisma.ReservaGetPayload<{ include: typeof incluirReserva }>

export function ajustesPublicos(fila: FilaAjustes): AjustesAgenda {
  return {
    antelacionMin: fila.antelacionMin,
    horizonteDias: fila.horizonteDias,
    cancelacionHoras: fila.cancelacionHoras,
    intervaloMin: fila.intervaloMin,
  }
}

export function servicioPublico(
  fila: FilaServicio & { tarifas: { personas: number; precioPorPersonaCentimos: number }[] },
): Servicio {
  return ServicioSchema.parse({
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    duracionMin: fila.duracionMin,
    minPersonas: fila.minPersonas,
    maxPersonas: fila.maxPersonas,
    claseDeSaldo: fila.claseDeSaldo,
    precioCentimos: fila.precioCentimos,
    tarifas: [...fila.tarifas]
      .sort((a, b) => a.personas - b.personas)
      .map((t) => ({ personas: t.personas, precioPorPersonaCentimos: t.precioPorPersonaCentimos })),
    reservable: fila.reservable,
    activo: fila.activo,
  })
}

/** La base de datos rechazó dos reservas confirmadas solapadas (EXCLUDE, 23P01). */
function esSolape(error: unknown): boolean {
  const texto = (() => {
    try {
      return `${String(error)} ${JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}))}`
    } catch {
      return String(error)
    }
  })()
  return texto.includes("23P01") || texto.includes("reservas_sin_solape")
}

function fechaCorta(instante: Date): string {
  const { fecha, minutos } = partesLocales(instante, ZONA_AGENDA)
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ${horaDeMinutos(minutos)}`
}

/**
 * Reservas en la agenda del entrenador (SPEC-agenda.md, «Reservar, cancelar y
 * mover»). Toda operación que ocupa tiempo toma primero el candado de la agenda
 * (la fila de ajustes) y después el del cliente; el orden es siempre ese.
 */
@Injectable()
export class ReservasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
    private readonly cobros: CobrosService,
  ) {}

  async ajustes(tx: Tx = this.prisma): Promise<FilaAjustes> {
    return tx.ajustesAgenda.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
  }

  /** Candado de la agenda: la fila única de ajustes, bloqueada hasta el final. */
  async bloquearAgenda(tx: Tx): Promise<FilaAjustes> {
    await this.ajustes(tx)
    await tx.$queryRaw`SELECT "id" FROM "ajustes_agenda" WHERE "id" = 1 FOR UPDATE`
    return tx.ajustesAgenda.findUniqueOrThrow({ where: { id: 1 } })
  }

  async servicios(actor: IdentidadVerificada): Promise<ListadoServicios> {
    const filas = await this.prisma.servicio.findMany({
      where: actor.rol === "cliente" ? { activo: true, reservable: true } : {},
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      include: { tarifas: true },
    })
    return { servicios: filas.map(servicioPublico) }
  }

  /** Huecos libres. Al cliente se le aplican antelación y horizonte; nunca se dice quién ocupa. */
  async disponibilidad(
    actor: IdentidadVerificada,
    consulta: ConsultarDisponibilidad,
  ): Promise<Disponibilidad> {
    const servicio = await this.servicioReservable(this.prisma, actor, consulta.servicioId)
    const ajustes = await this.ajustes()
    const dias = await this.huecos(this.prisma, {
      servicio,
      ajustes,
      desde: consulta.desde,
      dias: consulta.dias,
      limitesDeCliente: actor.rol === "cliente",
    })
    return {
      servicioId: servicio.id,
      zona: ZONA_AGENDA,
      dias: dias.map((dia) => ({
        fecha: dia.fecha,
        huecos: dia.huecos.map((h) => ({
          inicio: new Date(h.inicio).toISOString(),
          fin: new Date(h.fin).toISOString(),
        })),
      })),
    }
  }

  async misReservas(clienteId: string): Promise<MisReservas> {
    const ahora = new Date()
    const [proximas, pasadas] = await Promise.all([
      this.prisma.reserva.findMany({
        where: { clienteId, estado: "confirmada", fin: { gt: ahora } },
        orderBy: [{ inicio: "asc" }, { id: "asc" }],
        include: incluirReserva,
      }),
      this.prisma.reserva.findMany({
        where: { clienteId, OR: [{ estado: "cancelada" }, { fin: { lte: ahora } }] },
        orderBy: [{ inicio: "desc" }, { id: "asc" }],
        take: 20,
        include: incluirReserva,
      }),
    ])
    return { proximas: await this.publicas(proximas), pasadas: await this.publicas(pasadas) }
  }

  async listar(consulta: ConsultarReservas, clienteId?: string): Promise<ListadoReservas> {
    const desde =
      aInstante(consulta.desde, 0, ZONA_AGENDA) ?? new Date(`${consulta.desde}T00:00:00Z`)
    const hastaFecha = sumarDiasFecha(consulta.hasta, 1)
    const hasta = aInstante(hastaFecha, 0, ZONA_AGENDA) ?? new Date(`${hastaFecha}T00:00:00Z`)
    const filas = await this.prisma.reserva.findMany({
      where: { inicio: { gte: desde, lt: hasta }, ...(clienteId ? { clienteId } : {}) },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
      include: incluirReserva,
    })
    return { reservas: await this.publicas(filas) }
  }

  async listarPorIds(tx: Tx, ids: string[]): Promise<ListadoReservas> {
    const filas = await tx.reserva.findMany({
      where: { id: { in: ids } },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
      include: incluirReserva,
    })
    return { reservas: await this.publicas(filas, tx) }
  }

  async proximasDe(clienteId: string): Promise<Reserva[]> {
    const filas = await this.prisma.reserva.findMany({
      where: { clienteId, estado: "confirmada", fin: { gt: new Date() } },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
      take: 20,
      include: incluirReserva,
    })
    return this.publicas(filas)
  }

  /**
   * Reserva con id de operación: repetirla con el mismo contenido devuelve la
   * misma reserva; con otro contenido, conflicto. El cliente reserva para sí; el
   * entrenador, para cualquier cliente pendiente o activo.
   */
  async reservar(actor: IdentidadVerificada, clienteId: string, datos: Reservar): Promise<Reserva> {
    const inicio = new Date(datos.inicio)
    const repetida = async (tx: Tx): Promise<Reserva | null> => {
      const previa = await tx.reserva.findUnique({
        where: {
          creadaPorId_operacionId: { creadaPorId: actor.sub, operacionId: datos.operacionId },
        },
        include: incluirReserva,
      })
      if (!previa) return null
      const igual =
        previa.clienteId === clienteId &&
        previa.servicioId === datos.servicioId &&
        previa.inicio.getTime() === inicio.getTime() &&
        previa.personas === datos.personas
      if (!igual)
        throw conflicto("operacion_incompatible", "Esa operación ya se usó para otra reserva")
      return (await this.publicas([previa], tx))[0] ?? null
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ajustes = await this.bloquearAgenda(tx)
        const previa = await repetida(tx)
        if (previa) return previa
        await this.saldo.bloquearCliente(tx, clienteId)
        const servicio = await this.servicioReservable(tx, actor, datos.servicioId)
        if (datos.personas < servicio.minPersonas || datos.personas > servicio.maxPersonas)
          throw invalida(
            servicio.minPersonas === servicio.maxPersonas
              ? `Este servicio es para ${servicio.minPersonas} persona${servicio.minPersonas === 1 ? "" : "s"}`
              : `Este servicio es de ${servicio.minPersonas} a ${servicio.maxPersonas} personas`,
          )
        // Lo que no gasta saldo se cobra allí: sin precio para esas personas, la
        // sesión saldría gratis sin que nadie lo supiera.
        const importe = servicio.claseDeSaldo ? null : this.importeGrupo(servicio, datos.personas)
        if (!servicio.claseDeSaldo && importe === null)
          throw conflicto(
            "operacion_incompatible",
            `Este servicio no tiene precio para ${datos.personas} personas. Pide al entrenador que lo configure.`,
          )
        await this.exigirHueco(tx, {
          servicio,
          ajustes,
          inicio,
          limitesDeCliente: actor.rol === "cliente",
        })
        const id = randomUUID()
        const { fecha } = partesLocales(inicio, ZONA_AGENDA)
        await tx.reserva.create({
          data: {
            id,
            servicioId: servicio.id,
            clienteId,
            inicio,
            fin: new Date(inicio.getTime() + servicio.duracionMin * MS_MINUTO),
            personas: datos.personas,
            cargoSaldo: servicio.claseDeSaldo ? id : null,
            creadaPorId: actor.sub,
            operacionId: datos.operacionId,
          },
        })
        if (servicio.claseDeSaldo) {
          await this.saldo.consumir(tx, {
            clienteId,
            clase: servicio.claseDeSaldo,
            fechaSesion: fecha,
            origen: { tipo: "reserva", id },
            autorId: actor.sub,
          })
        } else if (importe !== null) {
          await this.cobros.crear(tx, {
            clienteId,
            concepto: `${servicio.nombre} · ${datos.personas} personas · ${fechaCorta(inicio)}`,
            importeCentimos: importe,
            origenTipo: "reserva",
            origenId: id,
            cobrado: false,
            autorId: actor.sub,
          })
        }
        const fila = await tx.reserva.findUniqueOrThrow({ where: { id }, include: incluirReserva })
        return (await this.publicas([fila], tx))[0]!
      })
    } catch (error) {
      if (esSolape(error)) throw conflicto("hueco_no_disponible", "Ese hueco acaba de ocuparse")
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const previa = await repetida(this.prisma)
        if (previa) return previa
      }
      throw error
    }
  }

  /**
   * Cancelar. El cliente recupera la sesión si cancela antes del plazo; después
   * libera el hueco y la pierde. Cuando cancela el entrenador, siempre vuelve.
   * Una reserva ya empezada no se cancela; cancelar otra vez no cambia nada.
   */
  async cancelar(
    actor: IdentidadVerificada,
    id: string,
    motivo: string | undefined,
  ): Promise<Reserva> {
    return this.prisma.$transaction(async (tx) => {
      const ajustes = await this.bloquearAgenda(tx)
      const reserva = await this.reservaDe(tx, actor, id)
      if (reserva.estado === "cancelada") return (await this.publicas([reserva], tx))[0]!
      const ahora = Date.now()
      if (reserva.inicio.getTime() <= ahora)
        throw conflicto("estado_incompatible", "Esa reserva ya ha empezado y no se puede cancelar")
      await this.saldo.bloquearCliente(tx, reserva.clienteId, false)
      const porEntrenador = actor.rol === "entrenador"
      const aTiempo = reserva.inicio.getTime() - ahora >= ajustes.cancelacionHoras * MS_HORA
      await tx.reserva.update({
        where: { id },
        data: {
          estado: "cancelada",
          canceladaEn: new Date(),
          canceladaPorId: actor.sub,
          canceladaPorEntrenador: porEntrenador,
          motivoCancelacion: motivo ?? null,
          revision: { increment: 1 },
        },
      })
      if (reserva.cargoSaldo && (porEntrenador || aTiempo))
        await this.saldo.devolver(tx, {
          origen: { tipo: "reserva", id: reserva.cargoSaldo },
          autorId: actor.sub,
        })
      await this.cobros.anularDeOrigen(tx, "reserva", id, actor.sub)
      const fila = await tx.reserva.findUniqueOrThrow({ where: { id }, include: incluirReserva })
      return (await this.publicas([fila], tx))[0]!
    })
  }

  /** El entrenador devuelve a mano la sesión de una cancelada tarde o de una pasada. Una vez. */
  async devolverAMano(actor: IdentidadVerificada, id: string): Promise<Reserva> {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await this.reservaDe(tx, actor, id)
      if (!reserva.cargoSaldo)
        throw conflicto("estado_incompatible", "Esa reserva no gastó ninguna sesión")
      if (reserva.estado === "confirmada" && reserva.fin.getTime() > Date.now())
        throw conflicto(
          "estado_incompatible",
          "Una reserva futura se cancela; la sesión vuelve al cancelarla",
        )
      await this.saldo.bloquearCliente(tx, reserva.clienteId, false)
      const devuelta = await this.saldo.devolver(tx, {
        origen: { tipo: "reserva", id: reserva.cargoSaldo },
        autorId: actor.sub,
      })
      if (!devuelta) throw conflicto("estado_incompatible", "Esa sesión ya se devolvió")
      await tx.reserva.update({
        where: { id },
        data: { devueltaAManoEn: new Date(), revision: { increment: 1 } },
      })
      const fila = await tx.reserva.findUniqueOrThrow({ where: { id }, include: incluirReserva })
      return (await this.publicas([fila], tx))[0]!
    })
  }

  /**
   * Mover: solo el entrenador y solo a un hueco libre. Si cambia de mes y gasta
   * saldo, devuelve la sesión al mes anterior y la gasta del nuevo en la misma
   * operación; sin saldo en el nuevo mes, no se mueve.
   */
  async mover(actor: IdentidadVerificada, id: string, datos: MoverReserva): Promise<Reserva> {
    const inicio = new Date(datos.inicio)
    try {
      return await this.prisma.$transaction(async (tx) => {
        const ajustes = await this.bloquearAgenda(tx)
        const reserva = await this.reservaDe(tx, actor, id)
        if (reserva.estado !== "confirmada")
          throw conflicto("estado_incompatible", "Solo se mueve una reserva confirmada")
        if (reserva.revision !== datos.revision)
          throw conflicto("revision_obsoleta", "La reserva ha cambiado. Actualiza la agenda.")
        if (reserva.inicio.getTime() <= Date.now())
          throw conflicto("estado_incompatible", "Esa reserva ya ha empezado")
        const servicio = await tx.servicio.findUniqueOrThrow({
          where: { id: reserva.servicioId },
          include: { tarifas: true },
        })
        await this.exigirHueco(tx, {
          servicio,
          ajustes,
          inicio,
          limitesDeCliente: false,
          ignorar: reserva.id,
        })
        await this.saldo.bloquearCliente(tx, reserva.clienteId, false)
        let cargoSaldo = reserva.cargoSaldo
        // Otro día puede necesitar otra fuente: otro mes del plan, o un bono que
        // para entonces ya habrá caducado. Se devuelve y se vuelve a gastar.
        const fechaAntes = partesLocales(reserva.inicio, ZONA_AGENDA).fecha
        const fechaNueva = partesLocales(inicio, ZONA_AGENDA).fecha
        if (servicio.claseDeSaldo && reserva.cargoSaldo && fechaAntes !== fechaNueva) {
          await this.saldo.devolver(tx, {
            origen: { tipo: "reserva", id: reserva.cargoSaldo },
            autorId: actor.sub,
          })
          cargoSaldo = `${reserva.id}#${reserva.revision + 1}`
          await this.saldo.consumir(tx, {
            clienteId: reserva.clienteId,
            clase: servicio.claseDeSaldo,
            fechaSesion: fechaNueva,
            origen: { tipo: "reserva", id: cargoSaldo },
            autorId: actor.sub,
          })
        }
        await tx.reserva.update({
          where: { id },
          data: {
            inicio,
            fin: new Date(inicio.getTime() + servicio.duracionMin * MS_MINUTO),
            cargoSaldo,
            revision: { increment: 1 },
          },
        })
        const fila = await tx.reserva.findUniqueOrThrow({ where: { id }, include: incluirReserva })
        return (await this.publicas([fila], tx))[0]!
      })
    } catch (error) {
      if (esSolape(error)) throw conflicto("hueco_no_disponible", "Ese hueco acaba de ocuparse")
      throw error
    }
  }

  /**
   * Baja de un cliente: cancela sus reservas futuras con devolución, dentro de la
   * transacción de la baja.
   */
  async cancelarFuturasDe(tx: Tx, clienteId: string, autorId: string): Promise<number> {
    await this.bloquearAgenda(tx)
    const futuras = await tx.reserva.findMany({
      where: { clienteId, estado: "confirmada", inicio: { gt: new Date() } },
    })
    for (const reserva of futuras) {
      await tx.reserva.update({
        where: { id: reserva.id },
        data: {
          estado: "cancelada",
          canceladaEn: new Date(),
          canceladaPorId: autorId,
          canceladaPorEntrenador: true,
          motivoCancelacion: "Baja del cliente",
          revision: { increment: 1 },
        },
      })
      if (reserva.cargoSaldo)
        await this.saldo.devolver(tx, {
          origen: { tipo: "reserva", id: reserva.cargoSaldo },
          autorId,
        })
      await this.cobros.anularDeOrigen(tx, "reserva", reserva.id, autorId)
    }
    return futuras.length
  }

  /** Tiempo libre del día de `inicio` y comprobación de que empieza en un hueco. */
  private async exigirHueco(
    tx: Tx,
    datos: {
      servicio: FilaServicio
      ajustes: FilaAjustes
      inicio: Date
      limitesDeCliente: boolean
      ignorar?: string
    },
  ): Promise<void> {
    const { fecha } = partesLocales(datos.inicio, ZONA_AGENDA)
    const [dia] = await this.huecos(tx, {
      servicio: datos.servicio,
      ajustes: datos.ajustes,
      desde: fecha,
      dias: 1,
      limitesDeCliente: datos.limitesDeCliente,
      ignorar: datos.ignorar,
    })
    if (!dia?.huecos.some((h) => h.inicio === datos.inicio.getTime()))
      throw conflicto("hueco_no_disponible", "Ese hueco ya no está disponible. Elige otro.")
  }

  private async huecos(
    tx: Tx,
    datos: {
      servicio: FilaServicio
      ajustes: FilaAjustes
      desde: string
      dias: number
      limitesDeCliente: boolean
      ignorar?: string
    },
  ): Promise<{ fecha: string; huecos: Tramo[] }[]> {
    const inicioRango =
      (aInstante(datos.desde, 0, ZONA_AGENDA)?.getTime() ?? Date.parse(datos.desde)) - MS_DIA
    const finRango =
      (aInstante(sumarDiasFecha(datos.desde, datos.dias), 0, ZONA_AGENDA)?.getTime() ??
        Date.parse(datos.desde) + datos.dias * MS_DIA) + MS_DIA
    const [franjas, excepciones, reservas] = await Promise.all([
      tx.franjaSemanal.findMany(),
      tx.excepcionAgenda.findMany({
        where: { inicio: { lt: new Date(finRango) }, fin: { gt: new Date(inicioRango) } },
      }),
      tx.reserva.findMany({
        where: {
          estado: "confirmada",
          inicio: { lt: new Date(finRango) },
          fin: { gt: new Date(inicioRango) },
          ...(datos.ignorar ? { id: { not: datos.ignorar } } : {}),
        },
        select: { inicio: true, fin: true },
      }),
    ])
    const tramo = (f: { inicio: Date; fin: Date }): Tramo => ({
      inicio: f.inicio.getTime(),
      fin: f.fin.getTime(),
    })
    const ahora = Date.now()
    return calcularHuecos({
      zona: ZONA_AGENDA,
      desde: datos.desde,
      dias: datos.dias,
      franjas,
      aperturas: excepciones.filter((e) => e.tipo === "apertura").map(tramo),
      ocupado: [
        ...excepciones.filter((e) => e.tipo === "cierre").map(tramo),
        ...reservas.map(tramo),
      ],
      duracionMin: datos.servicio.duracionMin,
      intervaloMin: datos.ajustes.intervaloMin,
      minimo: datos.limitesDeCliente ? ahora + datos.ajustes.antelacionMin * MS_MINUTO : ahora,
      ...(datos.limitesDeCliente ? { maximo: ahora + datos.ajustes.horizonteDias * MS_DIA } : {}),
    })
  }

  private async servicioReservable(
    tx: Tx,
    actor: IdentidadVerificada,
    servicioId: string,
  ): Promise<FilaServicio & { tarifas: { personas: number; precioPorPersonaCentimos: number }[] }> {
    const servicio = await tx.servicio.findUnique({
      where: { id: servicioId },
      include: { tarifas: true },
    })
    if (!servicio || !servicio.activo || (actor.rol === "cliente" && !servicio.reservable))
      throw new NotFoundException("Servicio no disponible")
    return servicio
  }

  private importeGrupo(
    servicio: FilaServicio & { tarifas: { personas: number; precioPorPersonaCentimos: number }[] },
    personas: number,
  ): number | null {
    const tarifa = servicio.tarifas.find((t) => t.personas === personas)
    if (tarifa) return tarifa.precioPorPersonaCentimos * personas
    return servicio.precioCentimos === null ? null : servicio.precioCentimos * personas
  }

  /** Una reserva ajena responde igual que una que no existe. */
  private async reservaDe(tx: Tx, actor: IdentidadVerificada, id: string): Promise<FilaReserva> {
    if (actor.rol !== "cliente" && actor.rol !== "entrenador") throw new ForbiddenException()
    const bloqueadas = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "reservas" WHERE "id" = ${id} FOR UPDATE`
    const reserva =
      bloqueadas.length === 1
        ? await tx.reserva.findUnique({ where: { id }, include: incluirReserva })
        : null
    if (!reserva || (actor.rol === "cliente" && reserva.clienteId !== actor.sub))
      throw new NotFoundException("Reserva no disponible")
    return reserva
  }

  private async publicas(filas: FilaReserva[], tx: Tx = this.prisma): Promise<Reserva[]> {
    if (filas.length === 0) return []
    const ajustes = await this.ajustes(tx)
    const fuentes = await this.saldo.fuentesDe(
      tx,
      "reserva",
      filas.flatMap((f) => (f.cargoSaldo ? [f.cargoSaldo] : [])),
    )
    const cobros = await tx.cobro.findMany({
      where: { origenTipo: "reserva", origenId: { in: filas.map((f) => f.id) } },
      select: { origenId: true, importeCentimos: true },
    })
    const cobroDe = new Map(cobros.map((c) => [c.origenId, c.importeCentimos]))
    return filas.map((fila) => {
      const fuente = fila.cargoSaldo ? fuentes.get(fila.cargoSaldo) : undefined
      return ReservaSchema.parse({
        id: fila.id,
        servicio: fila.servicio,
        cliente: fila.cliente,
        inicio: fila.inicio.toISOString(),
        fin: fila.fin.toISOString(),
        personas: fila.personas,
        estado: fila.estado,
        fuenteSaldo: fuente?.fuente ?? null,
        cobroCentimos: cobroDe.get(fila.id) ?? null,
        cancelarSinPerderHasta: new Date(
          fila.inicio.getTime() - ajustes.cancelacionHoras * MS_HORA,
        ).toISOString(),
        cancelacion:
          fila.estado === "cancelada" && fila.canceladaEn
            ? {
                en: fila.canceladaEn.toISOString(),
                porEntrenador: fila.canceladaPorEntrenador ?? false,
                motivo: fila.motivoCancelacion,
                sesionDevuelta: (fuente?.devuelto ?? false) && fila.devueltaAManoEn === null,
              }
            : null,
        devueltaAMano: fila.devueltaAManoEn !== null,
        revision: fila.revision,
        creadaEn: fila.creadaEn.toISOString(),
      })
    })
  }
}
