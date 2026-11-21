import type {
  ConfiguracionSeguimiento,
  Medida,
  ProgresionFuerza,
  SerieEvolucion,
} from "@alpha-omega/shared"

import { ordenMedidas } from "./paginas"
import { puntoDePartida } from "./punto-de-partida"

type Sentido = "favorable" | "desfavorable" | "neutral"

type FilaBase = {
  nombre: string
  unidad: string
  inicial: number | null
  actual: number
  diferencia: number | null
  fechaInicial: string | null
  fechaActual: string
  sentido: Sentido
}

export type FilaResumenProgreso =
  | (FilaBase & { tipo: "peso"; origen: "medidas" | "registro diario" })
  | (FilaBase & { tipo: "cintura"; origen: "medidas" })
  | (FilaBase & {
      tipo: "fuerza"
      origen: "primer registro disponible"
      ejercicioId: string
      repeticionesInicial: number | null
      repeticionesActual: number
    })
  | (FilaBase & {
      tipo: "composicion"
      origen: "valoraciones"
      clave: string
      metodo: string | null
      bloque: "bioimpedancia" | "pliegues"
    })

/** Califica el cambio solo si hay un objetivo explícito y comparable. */
function sentidoPeso(
  objetivo: ConfiguracionSeguimiento["objetivoPeso"],
  inicial: number,
  actual: number,
): Sentido {
  if (!objetivo || inicial === actual) return "neutral"
  if (objetivo.rangoKg) {
    const { minimo, maximo } = objetivo.rangoKg
    const distancia = (peso: number): number => Math.max(minimo - peso, 0, peso - maximo)
    const cambio = distancia(actual) - distancia(inicial)
    return cambio < 0 ? "favorable" : cambio > 0 ? "desfavorable" : "neutral"
  }
  if (objetivo.direccion === "mantener") return "neutral"
  const avanza = objetivo.direccion === "bajar" ? actual < inicial : actual > inicial
  return avanza ? "favorable" : "desfavorable"
}

/** Ordena una copia; cada medición se compara solo con su propio campo y fuente. */
export function crearResumenProgreso({
  configuracion,
  medidas,
  fuerza,
  evolucion = [],
}: {
  configuracion: ConfiguracionSeguimiento
  medidas: readonly Medida[]
  fuerza: readonly ProgresionFuerza["ejercicios"][number][]
  evolucion?: readonly SerieEvolucion[]
}): FilaResumenProgreso[] {
  const resultado: FilaResumenProgreso[] = []
  const resultadosFuerza: FilaResumenProgreso[] = []
  const composiciones: FilaResumenProgreso[] = []
  const tomas = [...medidas].sort(ordenMedidas)
  const puntoInicial = puntoDePartida(tomas)
  if (configuracion.indicadores.includes("peso")) {
    const conPeso = tomas.filter((toma) => toma.pesoKg !== null)
    const ultimo = conPeso.at(-1)
    if (ultimo && puntoInicial?.peso) {
      const inicial = conPeso.length > 1 ? puntoInicial.peso.valor : null
      const actual = ultimo.pesoKg!
      resultado.push({
        tipo: "peso",
        nombre: "Peso",
        unidad: "kg",
        origen: "medidas",
        inicial,
        actual,
        diferencia: inicial === null ? null : Number((actual - inicial).toFixed(1)),
        fechaInicial: inicial === null ? null : puntoInicial.peso.fecha,
        fechaActual: ultimo.fecha,
        sentido:
          inicial === null ? "neutral" : sentidoPeso(configuracion.objetivoPeso, inicial, actual),
      })
    } else {
      const serieDiaria = evolucion.find(
        (serie) =>
          serie.clave === "h:dia:pesoKg" &&
          serie.origen === "autorregistro" &&
          serie.unidad === "kg",
      )
      const puntos = [...(serieDiaria?.puntos ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]
      const actual = puntos.at(-1)
      if (primero && actual) {
        const inicial = puntos.length > 1 ? primero.valor : null
        resultado.push({
          tipo: "peso",
          nombre: "Peso",
          unidad: "kg",
          origen: "registro diario",
          inicial,
          actual: actual.valor,
          diferencia: inicial === null ? null : Number((actual.valor - inicial).toFixed(1)),
          fechaInicial: inicial === null ? null : primero.fecha,
          fechaActual: actual.fecha,
          sentido:
            inicial === null
              ? "neutral"
              : sentidoPeso(configuracion.objetivoPeso, inicial, actual.valor),
        })
      }
    }
  }
  if (configuracion.indicadores.includes("cintura")) {
    const conCintura = tomas.filter((toma) => toma.cinturaCm !== null)
    const primero = conCintura[0]
    const ultimo = conCintura.at(-1)
    if (primero && ultimo) {
      const inicial = conCintura.length > 1 ? primero.cinturaCm : null
      const actual = ultimo.cinturaCm!
      resultado.push({
        tipo: "cintura",
        nombre: "Cintura",
        unidad: "cm",
        origen: "medidas",
        inicial,
        actual,
        diferencia: inicial === null ? null : Number((actual - inicial).toFixed(1)),
        fechaInicial: inicial === null ? null : primero.fecha,
        fechaActual: ultimo.fecha,
        sentido: "neutral",
      })
    }
  }
  if (configuracion.indicadores.includes("fuerza")) {
    for (const ejercicio of fuerza) {
      const puntos = [...ejercicio.puntos].sort((a, b) => a.fecha.localeCompare(b.fecha))
      const primero = puntos[0]
      if (!primero) continue
      const mejor = puntos.reduce((actual, punto) =>
        punto.pesoKg > actual.pesoKg ||
        (punto.pesoKg === actual.pesoKg && punto.repeticiones > actual.repeticiones)
          ? punto
          : actual,
      )
      const inicial = puntos.length > 1 ? primero.pesoKg : null
      resultadosFuerza.push({
        tipo: "fuerza",
        ejercicioId: ejercicio.ejercicioId,
        nombre: ejercicio.nombre,
        unidad: "kg",
        origen: "primer registro disponible",
        inicial,
        actual: mejor.pesoKg,
        diferencia: inicial === null ? null : Number((mejor.pesoKg - inicial).toPrecision(12)),
        fechaInicial: inicial === null ? null : primero.fecha,
        fechaActual: mejor.fecha,
        repeticionesInicial: inicial === null ? null : primero.repeticiones,
        repeticionesActual: mejor.repeticiones,
        sentido: "neutral",
      })
    }
  }
  for (const serie of evolucion) {
    if (
      serie.origen !== "valoracion" ||
      !serie.clasificada ||
      (serie.bloque !== "bioimpedancia" && serie.bloque !== "pliegues")
    )
      continue
    const porVisita = new Map<string, SerieEvolucion["puntos"]>()
    for (const punto of serie.puntos) {
      if (punto.valoracionId === null) continue
      const existentes = porVisita.get(punto.valoracionId) ?? []
      existentes.push(punto)
      porVisita.set(punto.valoracionId, existentes)
    }
    const puntos = [...porVisita.values()]
      .filter((visita) => visita.length === 1)
      .map((visita) => visita[0]!)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
    const primero = puntos[0]
    const ultimo = puntos.at(-1)
    if (!primero || !ultimo || puntos.length < 2) continue
    composiciones.push({
      tipo: "composicion",
      origen: "valoraciones",
      clave: serie.clave,
      metodo: serie.metodo,
      bloque: serie.bloque,
      nombre: serie.nombre,
      unidad: serie.unidad,
      inicial: primero.valor,
      actual: ultimo.valor,
      diferencia: Number((ultimo.valor - primero.valor).toPrecision(12)),
      fechaInicial: primero.fecha,
      fechaActual: ultimo.fecha,
      sentido: "neutral",
    })
  }
  return [
    ...resultado,
    ...resultadosFuerza.slice(0, 1),
    ...composiciones.slice(0, 1),
    ...resultadosFuerza.slice(1),
    ...composiciones.slice(1),
  ].slice(0, 5)
}
