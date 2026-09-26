import { Injectable, NotFoundException } from "@nestjs/common"
import type { Bono, ClaseSaldo, Prisma, Suscripcion } from "@prisma/client"
import {
  hoyEnZona,
  mesDeFecha,
  MovimientoSaldoSchema,
  ResumenSaldoSchema,
  sumarDiasFecha,
  sumarMeses,
  ZONA_AGENDA,
  type BonoSaldo,
  type CupoMes,
  type DetalleSaldo,
  type ResumenSaldo,
} from "@alpha-omega/shared"

import { conflicto } from "../entrenamiento/documentos.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Una fecha de calendario como `@db.Date`. `planes` no importa `agenda` (SPEC-planes). */
const fechaSql = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`)

type Tx = Prisma.TransactionClient

/** Qué gastó una sesión: una reserva, una asistencia… Se guarda como tipo + id. */
export type OrigenSaldo = { tipo: string; id: string }

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

export function nombreDeMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? mes
}

const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)

/** Último mes que cubre una suscripción, incluido. */
function mesFin(suscripcion: Pick<Suscripcion, "mesInicio" | "meses">): string {
  return sumarMeses(fecha(suscripcion.mesInicio), suscripcion.meses - 1)
}

function cubre(suscripcion: Pick<Suscripcion, "mesInicio" | "meses">, mes: string): boolean {
  return fecha(suscripcion.mesInicio) <= mes && mes <= mesFin(suscripcion)
}

/** Un bono sirve para una sesión en `dia` si no ha caducado ese día. */
function vigente(bono: Pick<Bono, "caducaEn">, dia: string): boolean {
  return bono.caducaEn === null || dia < fecha(bono.caducaEn)
}

/**
 * Saldo de sesiones (SPEC-planes.md, «Reglas del saldo»).
 *
 * El saldo no se guarda: es lo concedido (cupo del plan en cada mes, sesiones de
 * cada bono) más la suma de sus movimientos. `consumir` y `devolver` reciben la
 * transacción de quien llama, que antes ha bloqueado la fila del cliente, para
 * que reservar y gastar sean una sola operación.
 */
@Injectable()
export class SaldoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Candado del cliente: su fila de usuario, bloqueada hasta el final de la
   * transacción. Si además hace falta el de la agenda, se toma antes ese.
   */
  async bloquearCliente(tx: Tx, clienteId: string, exigirActivo = true): Promise<void> {
    const filas = exigirActivo
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "usuarios"
          WHERE "id" = ${clienteId} AND "rol" = 'cliente' AND "estado" <> 'desactivado'
          FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "usuarios" WHERE "id" = ${clienteId} FOR UPDATE`
    if (filas.length !== 1) throw new NotFoundException("Cliente no disponible")
  }

  /** Gasta una sesión de la primera fuente que sirva. Sin saldo, 409 `sin_saldo`. */
  async consumir(
    tx: Tx,
    datos: {
      clienteId: string
      clase: ClaseSaldo
      fechaSesion: string
      origen: OrigenSaldo
      autorId: string
    },
  ): Promise<{ fuente: string }> {
    const mes = mesDeFecha(datos.fechaSesion)
    const suscripciones = await this.suscripcionesCon(tx, datos.clienteId, datos.clase, mes)
    const comun = {
      clienteId: datos.clienteId,
      cantidad: -1,
      motivo: "consumo" as const,
      fechaSesion: fechaSql(datos.fechaSesion),
      origenTipo: datos.origen.tipo,
      origenId: datos.origen.id,
      autorId: datos.autorId,
    }

    // 1. El plan del mes de la sesión.
    for (const { suscripcion, quedan } of suscripciones) {
      if (quedan <= 0) continue
      await tx.movimientoSaldo.create({
        data: { ...comun, suscripcionId: suscripcion.id, periodo: fechaSql(mes) },
      })
      return { fuente: `${suscripcion.nombre} · ${nombreDeMes(mes)}` }
    }

    // 2–4. Bonos empezados (el que caduca antes), sin empezar (el más antiguo) y sueltas.
    const bonos = (await this.bonosCon(tx, datos.clienteId, datos.clase))
      .filter(({ bono, quedan }) => quedan > 0 && vigente(bono, datos.fechaSesion))
      .sort((a, b) => ordenDeGasto(a.bono) - ordenDeGasto(b.bono) || compararBonos(a.bono, b.bono))
    const elegido = bonos[0]?.bono
    if (!elegido) throw conflicto("sin_saldo", "No quedan sesiones para esa fecha")

    await tx.movimientoSaldo.create({ data: { ...comun, bonoId: elegido.id } })
    await this.recalcularPrimerUso(tx, elegido)
    return { fuente: elegido.nombre }
  }

  /**
   * Deshace un consumo, una sola vez. Vuelve a su fuente; si esa fuente ya no
   * sirve (el mes pasó o el bono caducó), crea una sesión suelta de compensación.
   * Devuelve `null` si no hubo consumo o ya se había devuelto.
   */
  async devolver(
    tx: Tx,
    datos: { origen: OrigenSaldo; autorId: string },
  ): Promise<{ fuente: string } | null> {
    const clave = { origenTipo: datos.origen.tipo, origenId: datos.origen.id }
    const consumo = await tx.movimientoSaldo.findUnique({
      where: { origenTipo_origenId_motivo: { ...clave, motivo: "consumo" } },
      include: { suscripcion: true, bono: true },
    })
    if (!consumo) return null
    const yaDevuelto = await tx.movimientoSaldo.findUnique({
      where: { origenTipo_origenId_motivo: { ...clave, motivo: "devolucion" } },
      select: { id: true },
    })
    if (yaDevuelto) return null

    const hoy = hoyEnZona(ZONA_AGENDA)
    const comun = {
      clienteId: consumo.clienteId,
      cantidad: 1,
      motivo: "devolucion" as const,
      fechaSesion: consumo.fechaSesion,
      ...clave,
      autorId: datos.autorId,
    }

    if (consumo.suscripcion && consumo.periodo && fecha(consumo.periodo) >= mesDeFecha(hoy)) {
      await tx.movimientoSaldo.create({
        data: { ...comun, suscripcionId: consumo.suscripcion.id, periodo: consumo.periodo },
      })
      return { fuente: `${consumo.suscripcion.nombre} · ${nombreDeMes(fecha(consumo.periodo))}` }
    }

    if (consumo.bono && vigente(consumo.bono, hoy)) {
      await tx.movimientoSaldo.create({ data: { ...comun, bonoId: consumo.bono.id } })
      // Si era la única sesión gastada, el bono vuelve a estar sin empezar; si no,
      // su primer uso pasa a ser la sesión más temprana que sigue gastada.
      await this.recalcularPrimerUso(tx, consumo.bono)
      return { fuente: consumo.bono.nombre }
    }

    // La fuente ya no sirve: una sesión suelta de compensación, que dura un año.
    const clase = consumo.suscripcion?.clase ?? consumo.bono?.clase ?? "ep"
    const compensacion = await tx.bono.create({
      data: {
        clienteId: consumo.clienteId,
        nombre: "Sesión devuelta",
        clase,
        sesiones: 0,
        suelta: true,
        origen: "compensacion",
        creadoPorId: datos.autorId,
      },
    })
    await tx.movimientoSaldo.create({ data: { ...comun, bonoId: compensacion.id } })
    return { fuente: compensacion.nombre }
  }

  /**
   * El primer uso de un bono es la sesión más temprana que sigue gastada de él, y
   * caduca a los `validezDias` de ese día. Sin sesiones gastadas, sin empezar.
   * Así una sesión futura cancelada o una anterior reservada después no dejan la
   * caducidad anclada a otra fecha.
   */
  private async recalcularPrimerUso(tx: Tx, bono: Pick<Bono, "id" | "validezDias">): Promise<void> {
    const movimientos = await tx.movimientoSaldo.findMany({
      where: { bonoId: bono.id },
      select: { motivo: true, origenTipo: true, origenId: true, fechaSesion: true },
    })
    const clave = (m: { origenTipo: string; origenId: string }): string =>
      `${m.origenTipo}|${m.origenId}`
    const devueltos = new Set(movimientos.filter((m) => m.motivo === "devolucion").map(clave))
    const primera = movimientos
      .filter((m) => m.motivo === "consumo" && !devueltos.has(clave(m)))
      .map((m) => fecha(m.fechaSesion))
      .sort()[0]
    await tx.bono.update({
      where: { id: bono.id },
      data: primera
        ? {
            primerUsoEn: fechaSql(primera),
            caducaEn: fechaSql(sumarDiasFecha(primera, bono.validezDias)),
          }
        : { primerUsoEn: null, caducaEn: null },
    })
  }

  /** Nombre de la fuente de un consumo y si se devolvió, por origen. */
  async fuentesDe(
    tx: Tx,
    origenTipo: string,
    origenIds: string[],
  ): Promise<Map<string, { fuente: string; devuelto: boolean }>> {
    const resultado = new Map<string, { fuente: string; devuelto: boolean }>()
    if (origenIds.length === 0) return resultado
    const movimientos = await tx.movimientoSaldo.findMany({
      where: { origenTipo, origenId: { in: origenIds } },
      include: { suscripcion: { select: { nombre: true } }, bono: { select: { nombre: true } } },
    })
    for (const m of movimientos.filter((m) => m.motivo === "consumo"))
      resultado.set(m.origenId, { fuente: nombreDeFuente(m), devuelto: false })
    for (const m of movimientos.filter((m) => m.motivo === "devolucion")) {
      const previo = resultado.get(m.origenId)
      if (previo) previo.devuelto = true
    }
    return resultado
  }

  async resumen(
    clienteId: string,
    dia = hoyEnZona(ZONA_AGENDA),
    tx: Tx = this.prisma,
  ): Promise<ResumenSaldo> {
    const mes = mesDeFecha(dia)
    const siguiente = sumarMeses(mes, 1)
    const cupo = async (m: string): Promise<CupoMes | null> => {
      const lista = await this.suscripcionesCon(tx, clienteId, "ep", m)
      if (lista.length === 0) return null
      const total = lista.reduce((suma, { suscripcion }) => suma + suscripcion.sesionesPorMes, 0)
      const quedan = lista.reduce((suma, { quedan }) => suma + Math.max(0, quedan), 0)
      return { mes: m, cupo: total, usadas: Math.max(0, total - quedan), quedan }
    }
    const mesActual = await cupo(mes)
    const mesSiguiente = await cupo(siguiente)
    const bonos: BonoSaldo[] = (await this.bonosCon(tx, clienteId, "ep"))
      .filter(({ bono, quedan }) => quedan > 0 && vigente(bono, dia))
      .sort((a, b) => ordenDeGasto(a.bono) - ordenDeGasto(b.bono) || compararBonos(a.bono, b.bono))
      .map(({ bono, quedan }) => ({
        id: bono.id,
        nombre: bono.nombre,
        clase: bono.clase,
        sesiones: bono.sesiones,
        quedan,
        primerUsoEn: bono.primerUsoEn ? fecha(bono.primerUsoEn) : null,
        caducaEn: bono.caducaEn ? fecha(bono.caducaEn) : null,
        compensacion: bono.origen === "compensacion",
      }))
    const suscripciones = await tx.suscripcion.findMany({
      where: { clienteId },
      orderBy: [{ mesInicio: "asc" }, { creadaEn: "asc" }],
    })
    return ResumenSaldoSchema.parse({
      clienteId,
      fecha: dia,
      ep: {
        mesActual,
        mesSiguiente,
        bonos,
        disponibles: (mesActual?.quedan ?? 0) + bonos.reduce((suma, b) => suma + b.quedan, 0),
      },
      suscripciones: suscripciones
        .filter((s) => mesFin(s) >= mes)
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          clase: s.clase,
          sesionesPorMes: s.sesionesPorMes,
          mesInicio: fecha(s.mesInicio),
          mesFin: mesFin(s),
        })),
    })
  }

  async detalle(clienteId: string): Promise<DetalleSaldo> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const movimientos = await this.prisma.movimientoSaldo.findMany({
      where: { clienteId },
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
      take: 50,
      include: { suscripcion: { select: { nombre: true } }, bono: { select: { nombre: true } } },
    })
    return {
      resumen: await this.resumen(clienteId),
      movimientos: movimientos.map((m) =>
        MovimientoSaldoSchema.parse({
          id: m.id,
          cantidad: m.cantidad,
          motivo: m.motivo,
          fuente: nombreDeFuente(m),
          origenTipo: m.origenTipo,
          origenId: m.origenId,
          creadoEn: m.creadoEn.toISOString(),
        }),
      ),
    }
  }

  /** Suscripciones de la clase que cubren el mes, con lo que les queda en él. */
  private async suscripcionesCon(
    tx: Tx,
    clienteId: string,
    clase: ClaseSaldo,
    mes: string,
  ): Promise<{ suscripcion: Suscripcion; quedan: number }[]> {
    const todas = await tx.suscripcion.findMany({
      where: { clienteId, clase, sesionesPorMes: { gt: 0 }, mesInicio: { lte: fechaSql(mes) } },
      orderBy: [{ mesInicio: "asc" }, { creadaEn: "asc" }],
    })
    const cubren = todas.filter((s) => cubre(s, mes))
    if (cubren.length === 0) return []
    const sumas = await tx.movimientoSaldo.groupBy({
      by: ["suscripcionId"],
      where: { suscripcionId: { in: cubren.map((s) => s.id) }, periodo: fechaSql(mes) },
      _sum: { cantidad: true },
    })
    const neto = new Map(sumas.map((s) => [s.suscripcionId, s._sum.cantidad ?? 0]))
    return cubren.map((suscripcion) => ({
      suscripcion,
      quedan: suscripcion.sesionesPorMes + (neto.get(suscripcion.id) ?? 0),
    }))
  }

  private async bonosCon(
    tx: Tx,
    clienteId: string,
    clase: ClaseSaldo,
  ): Promise<{ bono: Bono; quedan: number }[]> {
    const bonos = await tx.bono.findMany({ where: { clienteId, clase } })
    if (bonos.length === 0) return []
    const sumas = await tx.movimientoSaldo.groupBy({
      by: ["bonoId"],
      where: { bonoId: { in: bonos.map((b) => b.id) } },
      _sum: { cantidad: true },
    })
    const neto = new Map(sumas.map((s) => [s.bonoId, s._sum.cantidad ?? 0]))
    return bonos.map((bono) => ({ bono, quedan: bono.sesiones + (neto.get(bono.id) ?? 0) }))
  }
}

/** Empezados antes que sin empezar; las sueltas, al final. */
function ordenDeGasto(bono: Bono): number {
  if (bono.suelta) return 2
  return bono.primerUsoEn === null ? 1 : 0
}

function compararBonos(a: Bono, b: Bono): number {
  const caducaA = a.caducaEn?.getTime() ?? Number.POSITIVE_INFINITY
  const caducaB = b.caducaEn?.getTime() ?? Number.POSITIVE_INFINITY
  return caducaA - caducaB || a.creadoEn.getTime() - b.creadoEn.getTime()
}

function nombreDeFuente(m: {
  periodo: Date | null
  suscripcion: { nombre: string } | null
  bono: { nombre: string } | null
}): string {
  if (m.suscripcion && m.periodo)
    return `${m.suscripcion.nombre} · ${nombreDeMes(fecha(m.periodo))}`
  return m.bono?.nombre ?? "Saldo"
}
