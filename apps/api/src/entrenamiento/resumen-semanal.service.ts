import { ForbiddenException, Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import {
  compararSemanas,
  estimar1RM,
  estadoDeProgresion,
  mejorSerieDeSemana,
  mejorSerieDeSesion,
  nivelDeMolestia,
  ResultadoEntrenamientoSchema,
  ResumenSemanalSchema,
  SintomaDeMolestiaSchema,
  type ResumenSemanal,
  type SerieRegistrada,
  type SerieRegistradaRepeticiones,
  type SerieResumenSemanal,
  type SesionDeProgresion,
} from "@alpha-omega/shared"
import { z } from "zod"
import { fechaSql, sumarDias } from "../agenda/fechas.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { leerDocumento } from "./documentos.js"

type Sesion = SesionDeProgresion & { sesionId: string }
type Historial = Map<string, { nombre: string; sesiones: Sesion[] }>
const Sintomas = z.array(SintomaDeMolestiaSchema).catch([])

function seriePublica(
  serie: SerieRegistradaRepeticiones | null,
  sesiones: Sesion[],
): SerieResumenSemanal | null {
  if (!serie) return null
  const sesion = sesiones.find(({ series }) => series.includes(serie))!
  return {
    sesionId: sesion.sesionId,
    fecha: sesion.fecha,
    pesoKg: serie.pesoKg!,
    repeticiones: serie.repeticiones!,
    rir: serie.rir ?? null,
    estimado1RM: estimar1RM(serie)!,
  }
}

@Injectable()
export class ResumenSemanalService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(identidad: IdentidadVerificada, semana: string): Promise<ResumenSemanal> {
    if (identidad.rol !== "entrenador") throw new ForbiddenException()
    const clientes = await this.prisma.usuario.findMany({
      where: { rol: "cliente", estado: "activo" },
      select: { id: true, nombre: true, apellidos: true },
      orderBy: [{ nombre: "asc" }, { apellidos: "asc" }, { id: "asc" }],
    })
    if (clientes.length === 0) return { semana, clientes: [] }
    const clienteId = { in: clientes.map(({ id }) => id) }
    const inicio = fechaSql(semana)
    const fin = fechaSql(sumarDias(semana, 7))
    const anterior = sumarDias(semana, -7)
    const [enviadas, previstas, molestias] = await Promise.all([
      this.prisma.sesionEntrenamiento.findMany({
        where: {
          clienteId,
          enviadoEn: { not: null },
          resultado: { not: Prisma.DbNull },
          agenda: { fechaActual: { lt: fin } },
        },
        select: {
          id: true,
          clienteId: true,
          version: true,
          resultado: true,
          agenda: { select: { fechaActual: true } },
        },
        orderBy: [{ agenda: { fechaActual: "asc" } }, { id: "asc" }],
      }),
      this.prisma.sesionEntrenamiento.groupBy({
        by: ["clienteId"],
        where: { clienteId, agenda: { fechaActual: { gte: inicio, lt: fin } } },
        _count: { _all: true },
      }),
      this.prisma.molestia.findMany({
        where: { clienteId, estado: "abierta", creadaEn: { lt: fin } },
        select: {
          id: true,
          clienteId: true,
          sesionId: true,
          zona: true,
          intensidad: true,
          sintomas: true,
          creadaEn: true,
        },
        orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
      }),
    ])

    const historiales = new Map<string, Historial>()
    const enviadasPorCliente = new Map<string, number>()
    for (const enviada of enviadas) {
      const fecha = enviada.agenda.fechaActual.toISOString().slice(0, 10)
      if (fecha >= semana)
        enviadasPorCliente.set(
          enviada.clienteId,
          (enviadasPorCliente.get(enviada.clienteId) ?? 0) + 1,
        )
      const resultado = leerDocumento(
        enviada.resultado,
        ResultadoEntrenamientoSchema,
        enviada.version,
      )
      const hechas = new Map(
        resultado.series.flatMap((serie) =>
          serie.hecha
            ? [[serie.serieId, { ...serie.valores, serieId: serie.serieId, hecha: true }] as const]
            : [],
        ),
      )
      const ejerciciosEnSesion = new Map<string, { nombre: string; series: SerieRegistrada[] }>()
      for (const ejercicio of resultado.prescripcion.ejercicios) {
        if (!ejercicio.compuesto || (ejercicio.seccion ?? "principal") !== "principal") continue
        const entrada = ejerciciosEnSesion.get(ejercicio.ejercicioId) ?? {
          nombre: ejercicio.nombre,
          series: [],
        }
        for (const prescrita of ejercicio.series) {
          const hecha = hechas.get(prescrita.id)
          if (hecha) entrada.series.push(hecha)
        }
        ejerciciosEnSesion.set(ejercicio.ejercicioId, entrada)
      }
      const historial = historiales.get(enviada.clienteId) ?? new Map()
      for (const [ejercicioId, ejercicio] of ejerciciosEnSesion) {
        const entrada = historial.get(ejercicioId) ?? { nombre: ejercicio.nombre, sesiones: [] }
        entrada.nombre = ejercicio.nombre
        entrada.sesiones.push({ sesionId: enviada.id, fecha, series: ejercicio.series })
        historial.set(ejercicioId, entrada)
      }
      historiales.set(enviada.clienteId, historial)
    }
    const previstasPorCliente = new Map(previstas.map((fila) => [fila.clienteId, fila._count._all]))
    const molestiasPorCliente = new Map<
      string,
      ResumenSemanal["clientes"][number]["molestiasAbiertas"]
    >()
    for (const molestia of molestias) {
      const lista = molestiasPorCliente.get(molestia.clienteId) ?? []
      lista.push({
        id: molestia.id,
        sesionId: molestia.sesionId,
        zona: molestia.zona,
        intensidad: molestia.intensidad,
        nivel: nivelDeMolestia(molestia.intensidad, Sintomas.parse(molestia.sintomas)),
        creadaEn: molestia.creadaEn.toISOString(),
      })
      molestiasPorCliente.set(molestia.clienteId, lista)
    }

    return ResumenSemanalSchema.parse({
      semana,
      clientes: clientes.map((cliente) => {
        const ejercicios: ResumenSemanal["clientes"][number]["ejercicios"] = []
        for (const [ejercicioId, { nombre, sesiones }] of historiales.get(cliente.id) ?? []) {
          const mejor = mejorSerieDeSemana(sesiones, semana)
          const previa = mejorSerieDeSemana(sesiones, anterior)
          if (!mejor && !previa) continue
          const historica = mejorSerieDeSesion(
            sesiones.filter(({ fecha }) => fecha < semana).flatMap(({ series }) => series),
          )
          ejercicios.push({
            ejercicioId,
            nombre,
            mejorSerie: seriePublica(mejor, sesiones),
            mejorSerieAnterior: seriePublica(previa, sesiones),
            comparacion: compararSemanas(mejor, previa),
            estado: mejor ? estadoDeProgresion(sesiones) : null,
            record:
              mejor !== null &&
              (!historica || compararSemanas(mejor, historica)?.direccion === "sube"),
          })
        }
        ejercicios.sort(
          (a, b) =>
            a.nombre.localeCompare(b.nombre, "es") || a.ejercicioId.localeCompare(b.ejercicioId),
        )
        return {
          clienteId: cliente.id,
          nombre: cliente.nombre,
          apellidos: cliente.apellidos,
          sesionesPrevistas: previstasPorCliente.get(cliente.id) ?? 0,
          sesionesEnviadas: enviadasPorCliente.get(cliente.id) ?? 0,
          ejercicios,
          molestiasAbiertas: molestiasPorCliente.get(cliente.id) ?? [],
        }
      }),
    })
  }
}
