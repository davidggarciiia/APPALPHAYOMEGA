import type {
  Molestia,
  ResultadoEntrenamiento,
  ValoresEjecutados,
  ValoresEjecutadosDistancia,
} from "@alpha-omega/shared"

import type { EdicionRegistro } from "../entrenamiento/registro-modelo"
import type { ResultadoConDistancia } from "../entrenamiento/resultado"
import {
  duracionLegible,
  kg,
  objetivoDeSerie,
  proximaVez,
  seriesDeTrabajo,
  textoRir,
  type ProximaVez,
} from "../entrenamiento/sesion/modelo"

const decimal = (valor: number): string => String(valor).replace(".", ",")

/** D01 · Lo ejecutado puede ir en metros aunque el contrato público no lo acepte hasta D01.g. */
type Ejecutado = ValoresEjecutados | ValoresEjecutadosDistancia

/** Lo hecho en su propia unidad; nunca se convierte a otra. */
function cantidadEjecutada(v: Ejecutado): number {
  switch (v.tipoMedicion) {
    case "repeticiones":
      return v.repeticiones
    case "tiempo":
      return v.segundos
    case "distancia":
      return v.metros
  }
}

/** «6», «30 s» o «20 m»: las repeticiones van sin unidad, como en el diseño. */
const SUFIJO = { repeticiones: "", tiempo: " s", distancia: " m" } as const satisfies Record<
  Ejecutado["tipoMedicion"],
  string
>

/** El resultado como la edición del registro, para calcular «La próxima vez». */
export function edicionDesdeResultado(resultado: ResultadoConDistancia): EdicionRegistro {
  return {
    notas: resultado.notas ?? "",
    checkin: resultado.checkin ?? null,
    inicio: resultado.inicio ?? null,
    cierre: resultado.cierre ?? null,
    series: resultado.series.map((serie) =>
      serie.hecha
        ? {
            serieId: serie.serieId,
            hecha: true,
            peso: serie.valores.pesoKg === null ? "" : decimal(serie.valores.pesoKg),
            valor: String(cantidadEjecutada(serie.valores)),
            rir: serie.valores.rir ?? null,
          }
        : { serieId: serie.serieId, hecha: false, peso: "", valor: "", rir: null },
    ),
  }
}

/** «67,5 × 6, 6, 6, 6», «32 × 20 m» o, si cambió la carga, «26 × 10, 9 · 22 × 10». */
export function hechoLegible(valores: Ejecutado[]): string {
  if (valores.length === 0) return "Quitada"
  const grupos: Array<{ peso: number | null; cantidades: string[] }> = []
  for (const v of valores) {
    const cantidad = `${cantidadEjecutada(v)}${SUFIJO[v.tipoMedicion]}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.peso === v.pesoKg) ultimo.cantidades.push(cantidad)
    else grupos.push({ peso: v.pesoKg, cantidades: [cantidad] })
  }
  return grupos
    .map((g) =>
      g.peso === null ? g.cantidades.join(", ") : `${decimal(g.peso)} × ${g.cantidades.join(", ")}`,
    )
    .join(" · ")
}

export type FilaDeSesion = {
  id: string
  nombre: string
  prescrito: string
  sugerido: string
  hecho: string
  rir: string
  proxima: ProximaVez | null
  conMolestia: boolean
}

/** La tabla de la sesión del diseño: prescrito, sugerido, hecho, RIR y próxima vez. */
export function filasDeSesion(
  resultado: ResultadoConDistancia,
  conMolestia: ReadonlySet<string>,
): FilaDeSesion[] {
  const hechas = new Map(
    resultado.series.flatMap((s) => (s.hecha ? [[s.serieId, s.valores] as const] : [])),
  )
  const proximas = new Map(
    proximaVez(resultado.prescripcion, edicionDesdeResultado(resultado), conMolestia).map((p) => [
      p.ejercicioId,
      p,
    ]),
  )
  return resultado.prescripcion.ejercicios
    .filter((e) => (e.seccion ?? "principal") !== "calentamiento")
    .map((ejercicio) => {
      const valores = ejercicio.series
        .map((s) => hechas.get(s.id))
        .filter((v): v is Ejecutado => v !== undefined)
      const objetivos = [...new Set(ejercicio.series.map(objetivoDeSerie))]
      const principal = (ejercicio.seccion ?? "principal") === "principal"
      const prescrito = principal
        ? [`${ejercicio.series.length} × ${objetivos.join(" / ")}`, textoRir(ejercicio.rir)]
            .filter(Boolean)
            .join(" · ")
        : (ejercicio.dosis ?? objetivos.join(" / "))
      const peso = ejercicio.series[0]?.pesoKg ?? null
      const rirs = valores
        .map((v) => v.rir)
        .filter((r): r is number => r !== null && r !== undefined)
      return {
        id: ejercicio.id,
        nombre: ejercicio.nombre,
        prescrito,
        sugerido: ejercicio.calibrar ? "Calibrar" : peso === null ? "—" : kg(peso),
        hecho: hechoLegible(valores),
        rir: rirs.length === 0 ? "—" : rirs.join(", "),
        proxima: proximas.get(ejercicio.id) ?? null,
        conMolestia: conMolestia.has(ejercicio.id),
      }
    })
}

/** Más de esto no es una sesión: la envió días después de empezarla. */
const DURACION_MAXIMA_MS = 5 * 60 * 60 * 1000

/** «1 h 38 min · RPE 7 · 20 de 20 series». */
export function resumenDeResultado(resultado: ResultadoEntrenamiento): string {
  const trabajo = new Set(seriesDeTrabajo(resultado.prescripcion))
  const hechas = resultado.series.filter((s) => s.hecha && trabajo.has(s.serieId)).length
  const dura = resultado.inicio
    ? Date.parse(resultado.enviadoEn) - Date.parse(resultado.inicio)
    : Number.NaN
  return [
    dura >= 0 && dura <= DURACION_MAXIMA_MS
      ? duracionLegible(resultado.inicio!, new Date(resultado.enviadoEn))
      : null,
    resultado.cierre ? `RPE ${resultado.cierre.esfuerzo}` : null,
    trabajo.size > 0 ? `${hechas} de ${trabajo.size} series` : null,
  ]
    .filter(Boolean)
    .join(" · ")
}

export type Senal = { texto: string; cumple: boolean }

/**
 * Señales para bajar volumen esta semana. Con dos, se propone bajar un 25–30 %
 * empezando por los accesorios; los ejercicios compuestos no se recortan.
 */
export function senalesDeVolumen(
  resultados: ResultadoEntrenamiento[],
  molestias: Molestia[],
): Senal[] {
  const cansado = resultados.filter((r) => (r.checkin?.sensacion ?? 5) <= 2).length
  const duras = resultados.filter((r) => (r.cierre?.esfuerzo ?? 0) >= 9).length
  let principales = 0
  let pordebajo = 0
  for (const r of resultados) {
    const hechas = new Map(
      r.series.flatMap((s) => (s.hecha ? [[s.serieId, s.valores] as const] : [])),
    )
    for (const e of r.prescripcion.ejercicios) {
      if ((e.seccion ?? "principal") !== "principal" || !e.rir) continue
      for (const s of e.series) {
        const v = hechas.get(s.id)
        if (!v || v.rir === null || v.rir === undefined) continue
        principales++
        if (v.rir < e.rir.min) pordebajo++
      }
    }
  }
  return [
    {
      texto: "Molestia ámbar o roja sin atender",
      cumple: molestias.some((m) => m.estado === "abierta" && m.nivel !== "verde"),
    },
    { texto: "Llega cansado a dos sesiones («¿Cómo llegas?» de 2 o menos)", cumple: cansado >= 2 },
    { texto: "Dos sesiones con esfuerzo de 9 o más", cumple: duras >= 2 },
    {
      texto: "RIR por debajo del objetivo en un tercio de las series principales",
      cumple: principales > 0 && pordebajo / principales >= 1 / 3,
    },
  ]
}
