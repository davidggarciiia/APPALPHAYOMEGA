import type { EjercicioPrescrito, SerieRegistrada, ValoresEjecutados } from "./entrenamiento"
import type { GrupoMuscular } from "./catalogo-ejercicios"
import { SemanaSchema } from "./agenda"

export type SerieRegistradaRepeticiones = Extract<SerieRegistrada, { tipoMedicion: "repeticiones" }>
export type SesionDeProgresion = {
  fecha: string
  /** Desempate común cuando hay varias sesiones en la misma fecha de agenda. */
  enviadoEn?: string
  sesionId?: string
  /** Solo las series de un mismo ejercicio, ya separadas por el consumidor. */
  series: readonly SerieRegistrada[]
}
export type ComparacionSemanal = {
  direccion: "sube" | "igual" | "baja"
  diferenciaKg: number
  diferenciaRepeticiones: number
  diferencia1RM: number
}
export type EstadoDeProgresion = "Progresa" | "Estancado" | "Baja"

function esSerieDeFuerza(serie: SerieRegistrada): serie is SerieRegistradaRepeticiones {
  return (
    serie.tipoMedicion === "repeticiones" &&
    serie.hecha &&
    !serie.omitida &&
    serie.pesoKg !== null &&
    serie.pesoKg > 0 &&
    serie.repeticiones !== null &&
    serie.repeticiones > 0
  )
}

function compararSeries(a: SerieRegistradaRepeticiones, b: SerieRegistradaRepeticiones): number {
  return (a.pesoKg ?? 0) - (b.pesoKg ?? 0) || (a.repeticiones ?? 0) - (b.repeticiones ?? 0)
}

function compararSesiones(a: SesionDeProgresion, b: SesionDeProgresion): number {
  return (
    Date.parse(a.fecha) - Date.parse(b.fecha) ||
    Date.parse(a.enviadoEn ?? a.fecha) - Date.parse(b.enviadoEn ?? b.fecha) ||
    (a.sesionId ?? "").localeCompare(b.sesionId ?? "")
  )
}

/** Más carga; a igualdad de kg, más repeticiones. El RIR no desempata. */
export function mejorSerieDeSesion(
  series: readonly SerieRegistrada[],
): SerieRegistradaRepeticiones | null {
  let mejor: SerieRegistradaRepeticiones | null = null
  for (const serie of series) {
    if (esSerieDeFuerza(serie) && (mejor === null || compararSeries(serie, mejor) > 0)) {
      mejor = serie
    }
  }
  return mejor
}

/** Semanas [lunes, lunes siguiente), con instantes UTC y desempate cronológico. */
export function mejorSerieDeSemana(
  sesiones: readonly SesionDeProgresion[],
  semana: string,
): SerieRegistradaRepeticiones | null {
  if (!SemanaSchema.safeParse(semana).success) return null
  const inicio = Date.parse(`${semana}T00:00:00Z`)
  const fin = inicio + 7 * 24 * 60 * 60 * 1000
  const deSemana = sesiones
    .filter(({ fecha }) => Date.parse(fecha) >= inicio && Date.parse(fecha) < fin)
    .sort(compararSesiones)
  return mejorSerieDeSesion(deSemana.flatMap(({ series }) => series))
}

/** Epley solo con lo levantado; no suma el RIR a las repeticiones. */
export function estimar1RM(
  serie: ValoresEjecutados | SerieRegistrada | null | undefined,
): number | null {
  if (
    serie?.tipoMedicion !== "repeticiones" ||
    serie.pesoKg === null ||
    serie.pesoKg <= 0 ||
    serie.repeticiones === null ||
    serie.repeticiones <= 0 ||
    ("hecha" in serie && (!serie.hecha || serie.omitida))
  ) {
    return null
  }
  return Math.round(serie.pesoKg * (1 + serie.repeticiones / 30) * 10) / 10
}

/** La ausencia de una semana no significa carga cero ni una bajada. */
export function compararSemanas(
  actual: SerieRegistradaRepeticiones | null,
  anterior: SerieRegistradaRepeticiones | null,
): ComparacionSemanal | null {
  if (!actual || !anterior || !esSerieDeFuerza(actual) || !esSerieDeFuerza(anterior)) return null
  const diferencia = compararSeries(actual, anterior)
  return {
    direccion: diferencia > 0 ? "sube" : diferencia < 0 ? "baja" : "igual",
    diferenciaKg: Number(((actual.pesoKg ?? 0) - (anterior.pesoKg ?? 0)).toPrecision(12)),
    diferenciaRepeticiones: (actual.repeticiones ?? 0) - (anterior.repeticiones ?? 0),
    diferencia1RM: Math.round(((estimar1RM(actual) ?? 0) - (estimar1RM(anterior) ?? 0)) * 10) / 10,
  }
}

/** Observa las últimas sesiones; una sesión sin fuerza no acredita continuidad. */
export function estadoDeProgresion(
  sesiones: readonly SesionDeProgresion[],
): EstadoDeProgresion | null {
  const ultimas = [...sesiones]
    .sort((a, b) => compararSesiones(b, a))
    .slice(0, 3)
    .map(({ series }) => mejorSerieDeSesion(series))
  const actual = compararSemanas(ultimas[0] ?? null, ultimas[1] ?? null)
  if (!actual) return null
  if (actual.direccion === "sube") return "Progresa"
  const anterior = compararSemanas(ultimas[1] ?? null, ultimas[2] ?? null)
  if (actual.direccion === "igual" && anterior?.direccion === "igual") return "Estancado"
  if (actual.direccion === "baja" && anterior?.direccion === "baja") return "Baja"
  return null
}

/** Sugerencia del cliente: cada serie prescrita debe acreditar su tope y su RIR. */
export function sugerenciaDeProgresion(
  ejercicio: EjercicioPrescrito,
  series: readonly SerieRegistrada[],
  grupoPrincipal?: GrupoMuscular,
): { incrementoKg: number } | null {
  if (
    ejercicio.tipoCarga === "sinCarga" ||
    ejercicio.calibrar ||
    !ejercicio.rir ||
    ejercicio.series.length === 0
  ) {
    return null
  }
  const rirMinimo = ejercicio.rir.min
  const cumplen = ejercicio.series.every((prescrita) => {
    const hecha = series.find((serie) => serie.serieId === prescrita.id)
    return (
      prescrita.tipoMedicion === "repeticiones" &&
      hecha !== undefined &&
      esSerieDeFuerza(hecha) &&
      (hecha.repeticiones ?? 0) >= (prescrita.repeticionesMax ?? prescrita.repeticiones) &&
      hecha.rir !== undefined &&
      hecha.rir !== null &&
      hecha.rir >= rirMinimo
    )
  })
  if (!cumplen) return null
  if (ejercicio.subidaKg !== undefined) return { incrementoKg: ejercicio.subidaKg }
  if (grupoPrincipal === undefined || grupoPrincipal === "abdomen") return null
  const inferior = ["gluteos", "cuadriceps", "isquiotibiales", "gemelos"].includes(grupoPrincipal)
  return { incrementoKg: inferior ? 5 : 2.5 }
}
