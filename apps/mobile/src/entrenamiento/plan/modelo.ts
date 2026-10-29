import {
  faseDeSemana,
  type DeporteDelPlan,
  type EjercicioPrescrito,
  type FaseDeBloque,
  type Prescripcion,
} from "@alpha-omega/shared"

import { sumarDias } from "../fechas"
import { objetivoDeSerie, textoRir } from "../sesion/modelo"

/** Lo que se hace, a la derecha de cada ejercicio: «4×6», «3×8–10», «1×8 por lado». */
export function dosisDeEjercicio(ejercicio: EjercicioPrescrito): string {
  if (ejercicio.dosis) return ejercicio.dosis
  const objetivos = ejercicio.series.map(objetivoDeSerie)
  if (objetivos.length === 1) return objetivos[0]!
  return new Set(objetivos).size === 1
    ? `${objetivos.length}×${objetivos[0]}`
    : objetivos.join(" / ")
}

/** Debajo de la dosis: «RIR 3 · 2–3 min». */
export function detalleDeEjercicio(ejercicio: EjercicioPrescrito): string | null {
  const partes = [textoRir(ejercicio.rir), ejercicio.descanso].filter(Boolean)
  return partes.length === 0 ? null : partes.join(" · ")
}

type Periodo = { semanaInicial: string; semanas: number }

/** La semana del bloque (1…n) a la que pertenece el lunes dado. */
export function semanaDelBloque(plan: Periodo, lunes: string): number {
  const dias =
    (Date.parse(`${lunes}T00:00:00Z`) - Date.parse(`${plan.semanaInicial}T00:00:00Z`)) / 86_400_000
  return Math.floor(dias / 7) + 1
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
export function fechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number)
  return `${dia} ${MESES[(mes ?? 1) - 1]}`
}

/** «21 sep – 1 nov»: del primer lunes al último domingo. */
export function fechasDelBloque(plan: Periodo): string {
  return `${fechaCorta(plan.semanaInicial)} – ${fechaCorta(sumarDias(plan.semanaInicial, plan.semanas * 7 - 1))}`
}

/** Índice de la fase que contiene la semana, o -1. */
export function faseActual(fases: FaseDeBloque[], semana: number): number {
  const fase = faseDeSemana(fases, semana)
  return fase ? fases.indexOf(fase) : -1
}

/** «Semanas 1–2» o «Semana 5». */
export function textoDeFase(fase: FaseDeBloque): string {
  return fase.desde === fase.hasta ? `Semana ${fase.desde}` : `Semanas ${fase.desde}–${fase.hasta}`
}

export const NOMBRES_DE_DIA = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
] as const
export const INICIALES_DE_DIA = ["L", "M", "X", "J", "V", "S", "D"] as const

function enumerar(elementos: string[]): string {
  return elementos.length <= 1
    ? (elementos[0] ?? "")
    : `${elementos.slice(0, -1).join(", ")} y ${elementos[elementos.length - 1]}`
}

/** «K-1: jueves y domingo, 60 min». */
export function textoDeDeporte(deporte: DeporteDelPlan): string {
  const dias = enumerar([...deporte.dias].sort((a, b) => a - b).map((d) => NOMBRES_DE_DIA[d - 1]!))
  return `${deporte.nombre}: ${dias}${deporte.minutos === null ? "" : `, ${deporte.minutos} min`}`
}

/**
 * Minutos del final: cardio y calma juntos cuando ambos son minutos exactos
 * («15» y «5» → «20»); si no, lo que diga la calma.
 */
export function minutosDeFinal(partes: Prescripcion["partes"]): string | null {
  if (!partes) return null
  const exacto = (texto: string | undefined): number | null =>
    texto !== undefined && /^\d+$/.test(texto.trim()) ? Number(texto) : null
  const cardio = exacto(partes.cardio)
  const calma = exacto(partes.calma)
  if (cardio !== null && calma !== null) return String(cardio + calma)
  return partes.calma ?? partes.cardio ?? null
}
