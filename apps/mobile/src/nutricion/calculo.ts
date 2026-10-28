import type { CalculoDeGasto, DocumentoDieta, Macros, Suplemento } from "@alpha-omega/shared"

/** Gasto total estimado: metabolismo basal por el factor de actividad. */
export function gastoTotal(basal: number, factor: number): number {
  return Math.round(basal * factor)
}

/** «Déficit de unos 230 kcal, un 7 %». Negativo si es superávit. */
export function deficit(kcal: number, gasto: number): { kcal: number; pct: number } {
  const diferencia = gasto - kcal
  return { kcal: diferencia, pct: gasto === 0 ? 0 : Math.round((diferencia / gasto) * 100) }
}

export type Porcentajes = { hidratos: number; proteina: number; grasas: number }

/** Gramos de cada macro para un reparto de las kcal (4, 4 y 9 kcal por gramo). */
export function gramosDeMacros(
  kcal: number,
  pct: Porcentajes,
): { hidratosG: number; proteinaG: number; grasaG: number } {
  return {
    hidratosG: Math.round((kcal * pct.hidratos) / 100 / 4),
    proteinaG: Math.round((kcal * pct.proteina) / 100 / 4),
    grasaG: Math.round((kcal * pct.grasas) / 100 / 9),
  }
}

/** El reparto de un objetivo ya escrito, para empezar a editarlo. */
export function porcentajesDe(objetivo: Macros): Porcentajes | null {
  const { kcal, hidratosG, proteinaG, grasaG } = objetivo
  if (!kcal || hidratosG === null || proteinaG === null || grasaG === null) return null
  const redondeados = {
    hidratos: Math.round(((hidratosG * 4) / kcal) * 100),
    proteina: Math.round(((proteinaG * 4) / kcal) * 100),
    grasas: Math.round(((grasaG * 9) / kcal) * 100),
  }
  if (redondeados.hidratos + redondeados.proteina + redondeados.grasas === 100) return redondeados
  const energia = [hidratosG * 4, proteinaG * 4, grasaG * 9]
  const total = energia.reduce((suma, valor) => suma + valor, 0)
  if (total === 0) return null
  const exactos = energia.map((valor) => (valor / total) * 100)
  const enteros = exactos.map(Math.floor)
  const orden = exactos
    .map((valor, i) => ({ i, fraccion: valor - enteros[i]! }))
    .sort((a, b) => b.fraccion - a.fraccion || a.i - b.i)
  const faltan = 100 - enteros.reduce((suma, valor) => suma + valor, 0)
  for (let i = 0; i < faltan; i++) enteros[orden[i]!.i]!++
  return { hidratos: enteros[0]!, proteina: enteros[1]!, grasas: enteros[2]! }
}

/** Lo que decide el profesional en «Pauta». */
export type Pauta = {
  objetivo: { kcal: number; hidratosG: number; proteinaG: number; grasaG: number }
  margenKcal: number
  suplementos: Suplemento[]
  registroComidas: boolean
  /** Añade la pauta «Peso en ayunas · cada día, al levantarte». */
  pesoDiario: boolean
  nota: string | null
  calculo: CalculoDeGasto
}

const PESO_DIARIO = { titulo: "Peso en ayunas", texto: "cada día, al levantarte" }

/**
 * La pauta sobre la dieta: el objetivo pasa a todos los tipos de día y se
 * conservan sus comidas. Sin dieta, una de objetivos para todos los días.
 */
export function aplicarPauta(
  documento: DocumentoDieta | null,
  pauta: Pauta,
  nuevoId: () => string,
): DocumentoDieta {
  const objetivo = { ...pauta.objetivo }
  let base = documento
  if (base == null) {
    const id = nuevoId()
    base = {
      formato: 1,
      nombre: "Objetivo diario",
      tiposDeDia: [{ id, nombre: "Todos los días", objetivo, comidas: [] }],
      semana: Array.from({ length: 7 }, () => id),
      indicaciones: [],
    }
  }
  const otras = base.indicaciones.filter((i) => i.titulo !== PESO_DIARIO.titulo)
  if (pauta.pesoDiario && otras.length >= 10) {
    throw new Error(
      "La dieta ya tiene diez indicaciones. Edita las indicaciones antes de añadir el peso diario.",
    )
  }
  return {
    ...base,
    tiposDeDia: base.tiposDeDia.map((tipo) => ({
      ...tipo,
      objetivo,
      margenKcal: pauta.margenKcal,
    })),
    indicaciones: pauta.pesoDiario ? [...otras, PESO_DIARIO] : otras,
    suplementos: pauta.suplementos,
    registroComidas: pauta.registroComidas,
    nota: pauta.nota,
    calculo: pauta.calculo,
  }
}
