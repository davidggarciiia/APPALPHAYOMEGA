import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import {
  BorradorSchema,
  estimar1RM,
  mejorSerieDeSesion,
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
  type ListadoAnteriores,
  type ListadoResultados,
  type ProgresionFuerza,
  type ListadoSesiones,
  type ValoresEjecutados,
  type SerieRegistrada,
  type ValoresEjecutadosDistancia,
  type SesionCliente,
  type SesionEntrenador,
} from "@alpha-omega/shared"
import { Prisma } from "@prisma/client"
import { agendaPublica, fechaSql, sumarDias } from "../agenda/fechas.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { leerDocumento } from "./documentos.js"

export type FilaSesion = Prisma.SesionEntrenamientoGetPayload<{ include: { agenda: true } }>

const DbNull = Prisma.DbNull

/** D01 · Lo hecho en cualquiera de las tres unidades; los metros se publican en D01.g. */
type ValoresEnUnidad = ValoresEjecutados | ValoresEjecutadosDistancia

/** Repeticiones, segundos o metros: la cantidad en la unidad de la serie. */
function cantidad(v: ValoresEnUnidad): number {
  switch (v.tipoMedicion) {
    case "repeticiones":
      return v.repeticiones
    case "tiempo":
      return v.segundos
    case "distancia":
      return v.metros
  }
}

/**
 * Más carga; a igual carga, más cantidad, como siempre entre repeticiones y
 * segundos (40 s ganan a 6). Los metros solo se comparan con metros: 20 m no
 * superan 10 repeticiones ni 60 s, y entonces se queda la primera.
 */
export function mejorSerie<T extends ValoresEnUnidad>(a: T, b: T): T {
  const cargaA = a.pesoKg ?? 0
  const cargaB = b.pesoKg ?? 0
  if (cargaA !== cargaB) return cargaA > cargaB ? a : b
  const conMetros = a.tipoMedicion === "distancia" || b.tipoMedicion === "distancia"
  if (conMetros && a.tipoMedicion !== b.tipoMedicion) return a
  return cantidad(b) > cantidad(a) ? b : a
}

/** Epley con repeticiones y carga. Tiempo y distancia no estiman fuerza. */
export function fuerzaEstimada(
  valores: ValoresEnUnidad | undefined,
): { pesoKg: number; repeticiones: number; estimado: number } | null {
  if (valores?.tipoMedicion !== "repeticiones") return null
  const estimado = estimar1RM(valores)
  if (estimado === null || valores.pesoKg === null) return null
  return { pesoKg: valores.pesoKg, repeticiones: valores.repeticiones, estimado }
}

@Injectable()
export class SesionesService {
  constructor(private readonly prisma: PrismaService) {}

  comprobarAcceso(identidad: IdentidadVerificada, clienteId: string, soloCliente = false): void {
    if (
      (!soloCliente && identidad.rol === "entrenador") ||
      (identidad.rol === "cliente" && identidad.sub === clienteId)
    )
      return
    if (identidad.rol === "cliente") throw new NotFoundException("Entrenamiento no disponible")
    throw new ForbiddenException("No tienes acceso a este entrenamiento")
  }

  async fila(
    tx: Prisma.TransactionClient,
    identidad: IdentidadVerificada,
    id: string,
    soloCliente = false,
  ): Promise<FilaSesion> {
    const fila = await tx.sesionEntrenamiento.findUnique({
      where: { id, ...(identidad.rol === "cliente" ? { clienteId: identidad.sub } : {}) },
      include: { agenda: true },
    })
    if (!fila) throw new NotFoundException("Entrenamiento no disponible")
    this.comprobarAcceso(identidad, fila.clienteId, soloCliente)
    return fila
  }

  async bloquear(
    tx: Prisma.TransactionClient,
    identidad: IdentidadVerificada,
    id: string,
    soloCliente = false,
  ): Promise<FilaSesion> {
    // Comprobar acceso antes de bloquear evita esperar sobre filas de otra cuenta.
    await this.fila(tx, identidad, id, soloCliente)
    await tx.$queryRaw`SELECT "id" FROM "sesiones_entrenamiento" WHERE "id" = ${id} FOR UPDATE`
    return this.fila(tx, identidad, id, soloCliente)
  }

  publica(fila: FilaSesion): SesionEntrenador {
    return SesionEntrenadorSchema.parse({
      agenda: agendaPublica(fila.agenda),
      prescripcion: leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version),
      revisionPrescripcion: fila.revisionPrescripcion,
      permiteAjuste: !fila.iniciada && fila.enviadoEn === null,
      enviadoEn: fila.enviadoEn?.toISOString() ?? null,
      revisadaEn: fila.revisadaEn?.toISOString() ?? null,
    })
  }

  async leer(
    identidad: IdentidadVerificada,
    id: string,
  ): Promise<SesionCliente | SesionEntrenador> {
    const fila = await this.fila(this.prisma, identidad, id)
    const publica = this.publica(fila)
    return identidad.rol === "cliente"
      ? SesionClienteSchema.parse({
          ...publica,
          borrador:
            fila.borrador === null
              ? null
              : leerDocumento(fila.borrador, BorradorSchema, fila.version),
        })
      : publica
  }

  /**
   * Para cada ejercicio de la sesión, la mejor serie hecha la última vez que el
   * cliente lo envió en otra sesión (más carga; a igual carga, más cantidad; los
   * metros solo frente a metros).
   */
  async anteriores(identidad: IdentidadVerificada, id: string): Promise<ListadoAnteriores> {
    const fila = await this.fila(this.prisma, identidad, id)
    const buscados = new Set(
      leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version).ejercicios.map(
        (e) => e.ejercicioId,
      ),
    )
    const anteriores: ListadoAnteriores["anteriores"] = []
    const ejerciciosBuscados = [...buscados]
    let cursor: string | undefined
    while (buscados.size > 0) {
      const enviadas = await this.prisma.sesionEntrenamiento.findMany({
        where: {
          clienteId: fila.clienteId,
          id: { not: id },
          resultado: { not: DbNull },
          referencias: { some: { ejercicioId: { in: ejerciciosBuscados } } },
        },
        orderBy: [{ enviadoEn: "desc" }, { id: "desc" }],
        take: 60,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: { id: true, resultado: true, version: true },
      })
      for (const enviada of enviadas) {
        const resultado = leerDocumento(
          enviada.resultado,
          ResultadoEntrenamientoSchema,
          enviada.version,
        )
        const hechas = new Map(
          resultado.series.flatMap((s) => (s.hecha ? [[s.serieId, s.valores] as const] : [])),
        )
        const mejores = new Map<string, ValoresEjecutados>()
        for (const ejercicio of resultado.prescripcion.ejercicios) {
          if (!buscados.has(ejercicio.ejercicioId)) continue
          const valores = ejercicio.series
            .map((serie) => hechas.get(serie.id))
            .filter((v): v is ValoresEjecutados => v !== undefined)
          if (valores.length === 0) continue
          const mejor = valores.reduce(mejorSerie)
          const anterior = mejores.get(ejercicio.ejercicioId)
          mejores.set(ejercicio.ejercicioId, anterior ? mejorSerie(anterior, mejor) : mejor)
        }
        for (const [ejercicioId, valores] of mejores) {
          buscados.delete(ejercicioId)
          anteriores.push({
            ejercicioId,
            fecha: resultado.enviadoEn,
            valores,
          })
        }
        if (buscados.size === 0) break
      }
      if (enviadas.length < 60) break
      cursor = enviadas.at(-1)!.id
    }
    return { anteriores }
  }

  /** Las últimas sesiones enviadas, con su resultado, para la ficha del cliente. */
  async resultados(
    identidad: IdentidadVerificada,
    clienteId: string,
    limite: number,
  ): Promise<ListadoResultados> {
    this.comprobarAcceso(identidad, clienteId)
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const filas = await this.prisma.sesionEntrenamiento.findMany({
      where: { clienteId, resultado: { not: DbNull } },
      include: { agenda: true },
      orderBy: [{ enviadoEn: "desc" }, { id: "asc" }],
      take: limite,
    })
    return {
      resultados: filas.map((fila) => ({
        agenda: agendaPublica(fila.agenda),
        resultado: leerDocumento(fila.resultado, ResultadoEntrenamientoSchema, fila.version),
      })),
    }
  }

  /**
   * «Fuerza»: mejor serie de E1 por ejercicio principal y sesión enviada,
   * con su estimación de Epley, por frecuencia de registro.
   */
  async fuerza(identidad: IdentidadVerificada, clienteId: string): Promise<ProgresionFuerza> {
    this.comprobarAcceso(identidad, clienteId)
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const enviadas = await this.prisma.sesionEntrenamiento.findMany({
      where: { clienteId, resultado: { not: DbNull } },
      include: { agenda: true },
      orderBy: [{ agenda: { fechaActual: "desc" } }, { id: "asc" }],
      take: 200,
    })
    const porEjercicio = new Map<
      string,
      { nombre: string; puntos: ProgresionFuerza["ejercicios"][number]["puntos"] }
    >()
    for (const enviada of enviadas.reverse()) {
      const resultado = leerDocumento(
        enviada.resultado,
        ResultadoEntrenamientoSchema,
        enviada.version,
      )
      const hechas = new Map(
        resultado.series.flatMap((s) => (s.hecha ? [[s.serieId, s.valores] as const] : [])),
      )
      const ejerciciosEnSesion = new Map<string, { nombre: string; series: SerieRegistrada[] }>()
      for (const ejercicio of resultado.prescripcion.ejercicios) {
        if ((ejercicio.seccion ?? "principal") !== "principal") continue
        const entrada = ejerciciosEnSesion.get(ejercicio.ejercicioId) ?? {
          nombre: ejercicio.nombre,
          series: [],
        }
        for (const serie of ejercicio.series) {
          const valores = hechas.get(serie.id)
          if (valores) entrada.series.push({ ...valores, serieId: serie.id, hecha: true })
        }
        ejerciciosEnSesion.set(ejercicio.ejercicioId, entrada)
      }
      for (const [ejercicioId, { nombre, series }] of ejerciciosEnSesion) {
        const mejor = mejorSerieDeSesion(series)
        const estimado = estimar1RM(mejor)
        if (!mejor || estimado === null) continue
        const entrada = porEjercicio.get(ejercicioId) ?? {
          nombre,
          puntos: [],
        }
        entrada.nombre = nombre
        entrada.puntos.push({
          fecha: agendaPublica(enviada.agenda).fechaActual,
          pesoKg: mejor.pesoKg!,
          repeticiones: mejor.repeticiones!,
          estimado,
        })
        porEjercicio.set(ejercicioId, entrada)
      }
    }
    const ejercicios = [...porEjercicio.entries()]
      .map(([ejercicioId, datos]) => ({ ejercicioId, ...datos }))
      .sort((a, b) => b.puntos.length - a.puntos.length)
    return { ejercicios }
  }

  async semana(
    identidad: IdentidadVerificada,
    clienteId: string,
    semana: string,
  ): Promise<ListadoSesiones> {
    this.comprobarAcceso(identidad, clienteId)
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const filas = await this.prisma.sesionEntrenamiento.findMany({
      where: {
        clienteId,
        agenda: { fechaActual: { gte: fechaSql(semana), lt: fechaSql(sumarDias(semana, 7)) } },
      },
      include: { agenda: true },
      orderBy: [{ agenda: { fechaActual: "asc" } }, { id: "asc" }],
    })
    const sesiones = filas.map((fila) => ({
      agenda: agendaPublica(fila.agenda),
      nombre: leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version).nombre,
      enviadoEn: fila.enviadoEn?.toISOString() ?? null,
    }))
    return { sesiones, total: sesiones.length }
  }
}
