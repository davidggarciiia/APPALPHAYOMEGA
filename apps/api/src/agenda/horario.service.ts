import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma, type ExcepcionAgenda as FilaExcepcion } from "@prisma/client"
import {
  aInstante,
  ExcepcionAgendaSchema,
  partesLocales,
  plantillaDelDia,
  restarTramos,
  sumarDiasFecha,
  unirTramos,
  ZONA_AGENDA,
  type AjustesAgenda,
  type CambiosAjustesAgenda,
  type CambiosServicio,
  type ConsultarReservas,
  type CrearExcepcion,
  type ExcepcionAgenda,
  type FranjaSemanal,
  type HorarioSemanal,
  type ListadoExcepciones,
  type Servicio,
  type Tramo,
} from "@alpha-omega/shared"

import { invalida } from "../entrenamiento/documentos.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { ajustesPublicos, ReservasService, servicioPublico } from "./reservas.service.js"

type Tx = Prisma.TransactionClient

function excepcionPublica(fila: FilaExcepcion): ExcepcionAgenda {
  return ExcepcionAgendaSchema.parse({
    id: fila.id,
    tipo: fila.tipo,
    inicio: fila.inicio.toISOString(),
    fin: fila.fin.toISOString(),
    motivo: fila.motivo,
    creadaEn: fila.creadaEn.toISOString(),
  })
}

/** Tiempo de trabajo de un día: plantilla ∪ aperturas − cierres, como los huecos. */
function tiempoDelDia(
  fecha: string,
  franjas: FranjaSemanal[],
  aperturas: Tramo[],
  cierres: Tramo[],
): Tramo[] {
  return restarTramos(
    unirTramos([...plantillaDelDia(fecha, franjas, ZONA_AGENDA), ...aperturas]),
    cierres,
  )
}

/**
 * Horario del entrenador, cierres y aperturas, ajustes y servicios. Si un cambio
 * dejaría reservas confirmadas fuera del horario, no se aplica y devuelve cuáles
 * (decisión 6): él las mueve o las cancela y repite.
 */
@Injectable()
export class HorarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservas: ReservasService,
  ) {}

  async horario(): Promise<HorarioSemanal> {
    const franjas = await this.prisma.franjaSemanal.findMany({
      orderBy: [{ diaSemana: "asc" }, { inicioMin: "asc" }],
    })
    return {
      franjas: franjas.map((f) => ({
        diaSemana: f.diaSemana,
        inicioMin: f.inicioMin,
        finMin: f.finMin,
      })),
    }
  }

  async guardarHorario(horario: HorarioSemanal): Promise<HorarioSemanal> {
    await this.prisma.$transaction(async (tx) => {
      await this.reservas.bloquearAgenda(tx)
      await this.exigirSinAfectadas(tx, { franjas: horario.franjas })
      await tx.franjaSemanal.deleteMany({})
      await tx.franjaSemanal.createMany({ data: horario.franjas })
    })
    return this.horario()
  }

  async excepciones(consulta: ConsultarReservas): Promise<ListadoExcepciones> {
    const desde =
      aInstante(consulta.desde, 0, ZONA_AGENDA) ?? new Date(`${consulta.desde}T00:00:00Z`)
    const finFecha = sumarDiasFecha(consulta.hasta, 1)
    const hasta = aInstante(finFecha, 0, ZONA_AGENDA) ?? new Date(`${finFecha}T00:00:00Z`)
    const filas = await this.prisma.excepcionAgenda.findMany({
      where: { inicio: { lt: hasta }, fin: { gt: desde } },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
    })
    return { excepciones: filas.map(excepcionPublica) }
  }

  async crearExcepcion(autorId: string, datos: CrearExcepcion): Promise<ExcepcionAgenda> {
    return this.prisma.$transaction(async (tx) => {
      await this.reservas.bloquearAgenda(tx)
      const nueva = { tipo: datos.tipo, inicio: new Date(datos.inicio), fin: new Date(datos.fin) }
      if (datos.tipo === "cierre") await this.exigirSinAfectadas(tx, { anadir: nueva })
      const fila = await tx.excepcionAgenda.create({
        data: { ...nueva, motivo: datos.motivo ?? null, autorId },
      })
      return excepcionPublica(fila)
    })
  }

  async borrarExcepcion(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.reservas.bloquearAgenda(tx)
      const fila = await tx.excepcionAgenda.findUnique({ where: { id } })
      if (!fila) throw new NotFoundException("Excepción no disponible")
      if (fila.tipo === "apertura") await this.exigirSinAfectadas(tx, { quitar: id })
      await tx.excepcionAgenda.delete({ where: { id } })
    })
  }

  async ajustes(): Promise<AjustesAgenda> {
    return ajustesPublicos(await this.reservas.ajustes())
  }

  async cambiarAjustes(cambios: CambiosAjustesAgenda): Promise<AjustesAgenda> {
    await this.reservas.ajustes()
    return ajustesPublicos(
      await this.prisma.ajustesAgenda.update({ where: { id: 1 }, data: cambios }),
    )
  }

  async cambiarServicio(id: string, cambios: CambiosServicio): Promise<Servicio> {
    const { tarifas, ...resto } = cambios
    try {
      const fila = await this.prisma.$transaction(async (tx) => {
        if (Object.keys(resto).length > 0) await tx.servicio.update({ where: { id }, data: resto })
        if (tarifas) {
          await tx.tarifaGrupo.deleteMany({ where: { servicioId: id } })
          await tx.tarifaGrupo.createMany({ data: tarifas.map((t) => ({ ...t, servicioId: id })) })
        }
        const servicio = await tx.servicio.findUniqueOrThrow({
          where: { id },
          include: { tarifas: true },
        })
        // Un servicio que se paga allí necesita precio para cada número de
        // personas que admite; si no, alguna reserva saldría gratis.
        if (!servicio.claseDeSaldo && servicio.precioCentimos === null) {
          const conPrecio = new Set(servicio.tarifas.map((t) => t.personas))
          const faltan: number[] = []
          for (let n = servicio.minPersonas; n <= servicio.maxPersonas; n++)
            if (!conPrecio.has(n)) faltan.push(n)
          if (faltan.length > 0)
            throw invalida(`Falta el precio por persona para ${faltan.join(", ")} personas`)
        }
        return servicio
      })
      return servicioPublico(fila)
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2025" || error.code === "P2003")
      )
        throw new NotFoundException("Servicio no disponible")
      if (error instanceof Prisma.PrismaClientKnownRequestError)
        throw invalida("Esos precios no se pueden guardar. Revisa las tarifas.")
      throw error
    }
  }

  /**
   * Comprueba que, con el cambio, cada reserva confirmada futura sigue dentro del
   * tiempo de trabajo. Si no, 409 `reservas_afectadas` con la lista.
   */
  private async exigirSinAfectadas(
    tx: Tx,
    cambio: {
      franjas?: FranjaSemanal[]
      anadir?: { tipo: "cierre" | "apertura"; inicio: Date; fin: Date }
      quitar?: string
    },
  ): Promise<void> {
    const ahora = new Date()
    const futuras = await tx.reserva.findMany({
      where: { estado: "confirmada", fin: { gt: ahora } },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
    })
    if (futuras.length === 0) return
    const franjas =
      cambio.franjas ??
      (await tx.franjaSemanal.findMany()).map((f) => ({
        diaSemana: f.diaSemana,
        inicioMin: f.inicioMin,
        finMin: f.finMin,
      }))
    const excepciones = (await tx.excepcionAgenda.findMany({ where: { fin: { gt: ahora } } }))
      .filter((e) => e.id !== cambio.quitar)
      .map((e) => ({ tipo: e.tipo, inicio: e.inicio, fin: e.fin }))
    if (cambio.anadir) excepciones.push(cambio.anadir)
    const tramo = (e: { inicio: Date; fin: Date }): Tramo => ({
      inicio: e.inicio.getTime(),
      fin: e.fin.getTime(),
    })
    const aperturas = excepciones.filter((e) => e.tipo === "apertura").map(tramo)
    const cierres = excepciones.filter((e) => e.tipo === "cierre").map(tramo)
    const afectadas = futuras.filter((r) => {
      const dias = new Set([
        partesLocales(r.inicio, ZONA_AGENDA).fecha,
        partesLocales(new Date(r.fin.getTime() - 1), ZONA_AGENDA).fecha,
      ])
      const libre = unirTramos(
        [...dias].flatMap((fecha) => tiempoDelDia(fecha, franjas, aperturas, cierres)),
      )
      return !libre.some((t) => t.inicio <= r.inicio.getTime() && r.fin.getTime() <= t.fin)
    })
    if (afectadas.length === 0) return
    const { reservas } = await this.reservas.listarPorIds(
      tx,
      afectadas.map((r) => r.id),
    )
    throw new ConflictException({
      statusCode: 409,
      codigo: "reservas_afectadas",
      message:
        afectadas.length === 1
          ? "Hay una reserva en ese tiempo. Muévela o cancélala antes."
          : `Hay ${afectadas.length} reservas en ese tiempo. Muévelas o cancélalas antes.`,
      conflictos: reservas,
    })
  }
}
