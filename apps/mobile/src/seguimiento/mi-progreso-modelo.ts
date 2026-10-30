import type {
  ConfiguracionSeguimiento,
  ProgresionFuerza,
  SerieEvolucion,
} from "@alpha-omega/shared"

import { sentidoDelPeso } from "./modelo"

export type Seccion = "medidas" | "composicion" | "pruebas"
export type Sentido = "neutral" | "favorable" | "desfavorable"
export type PuntoLinea = { fecha: string; valor: number }

/**
 * Una fila de Progreso: una magnitud con su serie principal. Nunca mezcla
 * series: inicio y actual salen de la misma; las demás quedan como `otras`.
 */
export type Linea = {
  clave: string
  seccion: Seccion
  nombre: string
  unidad: string
  /** Puntos de la serie principal, del más antiguo al más reciente. */
  puntos: PuntoLinea[]
  inicio: PuntoLinea
  actual: PuntoLinea
  /** `null` con un solo punto. */
  cambio: number | null
  sentido: Sentido
  /** Otras series con el mismo nombre (otro método, origen o protocolo). */
  otras: SerieEvolucion[]
}

export type LineaFuerza = {
  ejercicioId: string
  nombre: string
  puntos: ProgresionFuerza["ejercicios"][number]["puntos"]
  inicio: ProgresionFuerza["ejercicios"][number]["puntos"][number]
  actual: ProgresionFuerza["ejercicios"][number]["puntos"][number]
  /** Kg de la mejor serie, del primer día al último; `null` con un solo día. */
  cambio: number | null
}

/** Dónde va cada serie de la evolución; `null` si no es progreso (altura, fotos). */
export function seccionDe(serie: Pick<SerieEvolucion, "clave" | "bloque">): Seccion | null {
  if (serie.bloque === "medidas") return "medidas"
  if (serie.bloque === "bioimpedancia" || serie.bloque === "pliegues") return "composicion"
  if (serie.bloque === "pruebas") return "pruebas"
  if (serie.bloque === "fotos") return null
  if (serie.clave.startsWith("h:medida:alturaCm:")) return null
  if (serie.clave.startsWith("h:medida:grasaPct:")) return "composicion"
  if (serie.clave.startsWith("h:medida:") || serie.clave === "h:dia:pesoKg") return "medidas"
  if (serie.clave.startsWith("h:prueba")) return "pruebas"
  return null
}

const esPeso = (nombre: string): boolean => /\bpeso\b/i.test(nombre)
const esCintura = (nombre: string): boolean => /\bcintura\b/i.test(nombre)
const ordenar = (puntos: PuntoLinea[]): PuntoLinea[] =>
  [...puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
const redondear = (valor: number): number => Math.round(valor * 100) / 100

/** Lo que el entrenador no activó no aparece (peso, cintura y pruebas). */
function visible(seccion: Seccion, nombre: string, indicadores: readonly string[]): boolean {
  if (seccion === "pruebas") return indicadores.includes("pruebas")
  if (seccion === "medidas" && esPeso(nombre)) return indicadores.includes("peso")
  if (seccion === "medidas" && esCintura(nombre)) return indicadores.includes("cintura")
  return true
}

/** Principal: protocolo completo, luego el dato más reciente y luego más puntos. */
function antes(a: SerieEvolucion, b: SerieEvolucion): number {
  const incompleta = (s: SerieEvolucion): number => (s.clave.endsWith(":incompleto") ? 1 : 0)
  if (incompleta(a) !== incompleta(b)) return incompleta(a) - incompleta(b)
  const ultima = (s: SerieEvolucion): string => ordenar(s.puntos).at(-1)?.fecha ?? ""
  if (ultima(a) !== ultima(b)) return ultima(b).localeCompare(ultima(a))
  return b.puntos.length - a.puntos.length
}

/** Peso primero, luego cintura y el resto por nombre. */
function peso(linea: Pick<Linea, "nombre">): number {
  if (esPeso(linea.nombre)) return 0
  if (esCintura(linea.nombre)) return 1
  return 2
}

/** Filas de Medidas, Composición y Pruebas a partir de la evolución. */
export function lineasDeEvolucion(
  series: readonly SerieEvolucion[],
  configuracion: Pick<ConfiguracionSeguimiento, "indicadores" | "objetivoPeso">,
): Linea[] {
  const grupos = new Map<string, { seccion: Seccion; series: SerieEvolucion[] }>()
  for (const serie of series) {
    const seccion = seccionDe(serie)
    if (!seccion || serie.puntos.length === 0) continue
    if (!visible(seccion, serie.nombre, configuracion.indicadores)) continue
    const clave = `${seccion}|${serie.nombre.trim().toLowerCase()}|${serie.unidad}`
    const grupo = grupos.get(clave) ?? { seccion, series: [] }
    grupo.series.push(serie)
    grupos.set(clave, grupo)
  }
  const lineas: Linea[] = []
  for (const [clave, { seccion, series: delGrupo }] of grupos) {
    const [principal, ...otras] = [...delGrupo].sort(antes)
    const puntos = ordenar(principal!.puntos.map((p) => ({ fecha: p.fecha, valor: p.valor })))
    const inicio = puntos[0]!
    const actual = puntos.at(-1)!
    const cambio = puntos.length > 1 ? redondear(actual.valor - inicio.valor) : null
    lineas.push({
      clave,
      seccion,
      nombre: principal!.nombre,
      unidad: principal!.unidad,
      puntos,
      inicio,
      actual,
      cambio,
      sentido:
        cambio !== null && esPeso(principal!.nombre) && principal!.unidad === "kg"
          ? sentidoDelPeso(configuracion.objetivoPeso, inicio.valor, actual.valor)
          : "neutral",
      otras,
    })
  }
  return lineas.sort(
    (a, b) => peso(a) - peso(b) || a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
  )
}

/** Fuerza por ejercicio: lo entrenado más recientemente arriba. */
export function lineasDeFuerza(ejercicios: ProgresionFuerza["ejercicios"]): LineaFuerza[] {
  return ejercicios
    .filter((e) => e.puntos.length > 0)
    .map((e) => {
      const puntos = [...e.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const inicio = puntos[0]!
      const actual = puntos.at(-1)!
      return {
        ejercicioId: e.ejercicioId,
        nombre: e.nombre,
        puntos,
        inicio,
        actual,
        cambio: puntos.length > 1 ? redondear(actual.pesoKg - inicio.pesoKg) : null,
      }
    })
    .sort(
      (a, b) =>
        b.actual.fecha.localeCompare(a.actual.fecha) ||
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }),
    )
}

export type FilaResumen = {
  clave: string
  nombre: string
  inicio: string
  actual: string
  cambio: string
  sentido: Sentido
}

/**
 * «Desde el inicio»: lo que más dice de un vistazo. Peso, cintura y grasa si
 * han cambiado, y el ejercicio que más ha subido. Nada con un solo dato.
 */
export function resumen(lineas: readonly Linea[], fuerza: readonly LineaFuerza[]): FilaResumen[] {
  const filas: FilaResumen[] = []
  const elegir = (seccion: Seccion, prueba: (nombre: string) => boolean): void => {
    const linea = lineas.find((l) => l.seccion === seccion && prueba(l.nombre) && l.cambio)
    if (!linea) return
    filas.push({
      clave: linea.clave,
      nombre: linea.nombre,
      inicio: conUnidad(linea.inicio.valor, linea.unidad),
      actual: conUnidad(linea.actual.valor, linea.unidad),
      cambio: diferencia(linea.cambio!, linea.unidad),
      sentido: linea.sentido,
    })
  }
  elegir("medidas", esPeso)
  elegir("medidas", esCintura)
  elegir("composicion", (nombre) => /grasa/i.test(nombre))
  const mejor = [...fuerza]
    .filter((f) => f.cambio !== null && f.cambio > 0)
    .sort((a, b) => b.cambio! - a.cambio!)[0]
  if (mejor)
    filas.push({
      clave: `fuerza|${mejor.ejercicioId}`,
      nombre: mejor.nombre,
      inicio: conUnidad(mejor.inicio.pesoKg, "kg"),
      actual: conUnidad(mejor.actual.pesoKg, "kg"),
      cambio: diferencia(mejor.cambio!, "kg"),
      sentido: "favorable",
    })
  return filas
}

/** «104,2»: hasta dos decimales, con coma y sin ceros de relleno. */
export const cifra = (valor: number): string =>
  String(Math.round(valor * 100) / 100).replace(".", ",")

/** Un índice del fabricante no es kg ni %: se rotula como lo que es. */
export const unidadLegible = (unidad: string): string => (unidad === "indice" ? "índice" : unidad)

export const conUnidad = (valor: number, unidad: string): string =>
  `${cifra(valor)} ${unidadLegible(unidad)}`

/** «+1,5 kg», «−0,4 %» o «Sin cambios». */
export function diferencia(valor: number, unidad: string): string {
  if (valor === 0) return "Sin cambios"
  return `${valor > 0 ? "+" : "−"}${conUnidad(Math.abs(valor), unidad)}`
}
