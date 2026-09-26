import type {
  ConfiguracionSeguimiento,
  DiaDeSeguimiento,
  Medida,
  ProximaRevision,
} from "@alpha-omega/shared"

import { fechaCorta } from "../entrenamiento/plan/modelo"
import { haceDias } from "./fotos-modelo"
import { mediaMovil, pesoLegible, sentidoDelPeso } from "./modelo"
import { puntoDePartida } from "./punto-de-partida"

export type Sentido = "neutral" | "favorable" | "desfavorable"

/** Una cifra del resumen de Progreso, con de dónde sale y cuánto ha cambiado. */
export type CifraClave = {
  clave: "peso" | "grasa" | "cintura" | "revision"
  titulo: string
  valor: string
  /** Qué es la cifra: «Media de 7 días», «Medida del 15 sep». */
  nota: string | null
  /** Desde el primer dato de la misma medida: «−2,4 kg desde el 10 ene». */
  cambio: string | null
  sentido: Sentido
}

export const decimal = (valor: number): string => valor.toFixed(1).replace(".", ",")

/** «−0,2 kg», «+1,0 cm». */
export function diferencia(valor: number, unidad: string): string {
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "±"
  return `${signo}${decimal(Math.abs(valor))} ${unidad}`
}

/** «92,5 cm», «94 cm». */
export const cintura = (cm: number): string => `${decimal(cm).replace(",0", "")} cm`

/** Orden de las tomas: fecha, creación e identificador, como en el punto de partida. */
function cronologico(a: Medida, b: Medida): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** «−1,5 cm desde el 17 sep»; sin variación, «Sin cambios desde el 17 sep». */
function cambioDesde(actual: number, inicio: number, unidad: string, fecha: string): string {
  const variacion = Math.round((actual - inicio) * 10) / 10
  return variacion === 0
    ? `Sin cambios desde el ${fechaCorta(fecha)}`
    : `${diferencia(variacion, unidad)} desde el ${fechaCorta(fecha)}`
}

/**
 * La última y la primera toma de un mismo dato. Cada cambio compara una medida
 * consigo misma en otra fecha: nunca combina datos de tomas distintas en un
 * valor calculado.
 */
function extremos(
  medidas: readonly Medida[],
  campo: "grasaPct" | "cinturaCm",
): { primera: Medida; ultima: Medida } | null {
  const con = medidas.filter((m) => m[campo] !== null)
  const primera = con[0]
  const ultima = con[con.length - 1]
  return primera && ultima ? { primera, ultima } : null
}

function cifraDeMedida(
  medidas: readonly Medida[],
  campo: "grasaPct" | "cinturaCm",
): CifraClave | null {
  const tomas = extremos(medidas, campo)
  if (!tomas) return null
  const { primera, ultima } = tomas
  const unidad = campo === "grasaPct" ? "%" : "cm"
  const valor = ultima[campo]!
  return {
    clave: campo === "grasaPct" ? "grasa" : "cintura",
    titulo: campo === "grasaPct" ? "Grasa corporal" : "Cintura",
    valor: campo === "grasaPct" ? `${decimal(valor)} %` : cintura(valor),
    nota: `Medida del ${fechaCorta(ultima.fecha)}`,
    cambio:
      primera.id !== ultima.id && primera.fecha < ultima.fecha
        ? cambioDesde(valor, primera[campo]!, unidad, primera.fecha)
        : null,
    sentido: "neutral",
  }
}

function cifraDePeso(
  configuracion: ConfiguracionSeguimiento,
  dias: readonly DiaDeSeguimiento[],
  medidas: readonly Medida[],
): CifraClave | null {
  const diarios = dias.filter((d) => d.pesoKg !== null)
  const media = mediaMovil([...dias], 7).at(-1)
  const medido = medidas.filter((m) => m.pesoKg !== null).at(-1)
  // Con pesos diarios manda la media de la semana, como en la gráfica.
  const actual = media
    ? { valor: media.valor, fecha: media.fecha, nota: "Media de 7 días" }
    : medido
      ? {
          valor: medido.pesoKg!,
          fecha: medido.fecha,
          nota: `Medida del ${fechaCorta(medido.fecha)}`,
        }
      : null
  if (!actual) return null
  const partida = puntoDePartida(medidas)?.peso
  const inicio =
    partida ?? (diarios[0] ? { valor: diarios[0].pesoKg!, fecha: diarios[0].fecha } : null)
  const comparable = inicio !== null && inicio.fecha < actual.fecha
  return {
    clave: "peso",
    titulo: "Peso",
    valor: pesoLegible(actual.valor),
    nota: actual.nota,
    cambio: comparable ? cambioDesde(actual.valor, inicio.valor, "kg", inicio.fecha) : null,
    sentido: comparable
      ? sentidoDelPeso(configuracion.objetivoPeso, inicio.valor, actual.valor)
      : "neutral",
  }
}

function cifraDeRevision(proxima: ProximaRevision, hoy: string): CifraClave {
  const { pauta, cumplidaPorId } = proxima
  const base = { clave: "revision", titulo: "Próxima revisión", cambio: null } as const
  if (!pauta) return { ...base, valor: "Sin programar", nota: null, sentido: "neutral" }
  const hecha = cumplidaPorId !== null ? "Ya realizada" : null
  if (pauta.fecha)
    return {
      ...base,
      valor: fechaCorta(pauta.fecha),
      nota: hecha ?? haceDias(pauta.fecha, hoy),
      sentido: hecha ? "favorable" : "neutral",
    }
  const semanas = pauta.intervaloSemanas ?? 1
  return {
    ...base,
    valor: semanas === 1 ? "Cada semana" : `Cada ${semanas} semanas`,
    nota: hecha,
    sentido: hecha ? "favorable" : "neutral",
  }
}

/**
 * Las cifras clave de Progreso, de un vistazo: peso, grasa y cintura con su
 * cambio desde el primer dato, y la próxima revisión. Solo lo que el
 * entrenador deja ver: el peso con el indicador «Peso», la cintura con
 * «Cintura» y la grasa con cualquiera de los dos, como el bloque «Inicio».
 * `proxima` es `undefined` si no se consulta (en la ficha del entrenador).
 */
export function cifrasClave({
  configuracion,
  dias,
  medidas,
  proxima,
  hoy,
}: {
  configuracion: ConfiguracionSeguimiento
  dias: readonly DiaDeSeguimiento[]
  medidas: readonly Medida[]
  proxima?: ProximaRevision | null
  hoy: string
}): CifraClave[] {
  const ordenadas = [...medidas].sort(cronologico)
  const visible = (indicador: ConfiguracionSeguimiento["indicadores"][number]): boolean =>
    configuracion.indicadores.includes(indicador)
  const cifras: Array<CifraClave | null> = [
    visible("peso") ? cifraDePeso(configuracion, dias, ordenadas) : null,
    visible("peso") || visible("cintura") ? cifraDeMedida(ordenadas, "grasaPct") : null,
    visible("cintura") ? cifraDeMedida(ordenadas, "cinturaCm") : null,
    proxima ? cifraDeRevision(proxima, hoy) : null,
  ]
  return cifras.filter((c): c is CifraClave => c !== null)
}
