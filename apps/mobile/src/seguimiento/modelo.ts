import type { DiaDeSeguimiento } from "@alpha-omega/shared"

import { sumarDias } from "../entrenamiento/fechas"

const redondear = (valor: number): number => Math.round(valor * 10) / 10

/** «111,6 kg». */
export function pesoLegible(kg: number): string {
  return `${kg.toFixed(1).replace(".", ",")} kg`
}

/** «3.240»: punto de miles también con cuatro cifras, como en el diseño. */
export function miles(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** «7 h 40». */
export function suenoLegible(minutos: number): string {
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, "0")}`
}

/** «111,6» → 111.6; vacío → null; texto que no es número → NaN. */
export function leerDecimal(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".")
  if (limpio === "") return null
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN
}

/** «7:40», «7 h 40», «7,5» u «8» → minutos. */
export function leerSueno(texto: string): number | null {
  const limpio = texto.trim().toLowerCase()
  if (limpio === "") return null
  const partes = limpio.match(/^(\d{1,2})\s*(?::|h)\s*(\d{1,2})$/)
  if (partes) return Number(partes[1]) * 60 + Number(partes[2])
  const horas = leerDecimal(limpio)
  return horas === null || Number.isNaN(horas) ? Number.NaN : Math.round(horas * 60)
}

/** Media con un decimal de los valores que hay. */
export function media(valores: Array<number | null>): number | null {
  const hay = valores.filter((v): v is number => v !== null)
  return hay.length === 0 ? null : redondear(hay.reduce((a, b) => a + b, 0) / hay.length)
}

/** Para cada día con peso, la media de los pesos de los `dias` anteriores (él incluido). */
export function mediaMovil(
  dias: DiaDeSeguimiento[],
  ventana: number,
): Array<{ fecha: string; valor: number }> {
  const conPeso = dias.filter((d) => d.pesoKg !== null)
  return conPeso.map((d) => {
    const desde = sumarDias(d.fecha, -(ventana - 1))
    const dentro = conPeso.filter((o) => o.fecha >= desde && o.fecha <= d.fecha)
    return { fecha: d.fecha, valor: media(dentro.map((o) => o.pesoKg))! }
  })
}

/** Peso, pasos y sueño medios de la semana que empieza en `lunes`. */
export function resumenDeSemana(
  dias: DiaDeSeguimiento[],
  lunes: string,
): { pesoKg: number | null; pasos: number | null; suenoMin: number | null } {
  const fin = sumarDias(lunes, 6)
  const semana = dias.filter((d) => d.fecha >= lunes && d.fecha <= fin)
  const entero = (valor: number | null): number | null =>
    valor === null ? null : Math.round(valor)
  return {
    pesoKg: media(semana.map((d) => d.pesoKg)),
    pasos: entero(media(semana.map((d) => d.pasos))),
    suenoMin: entero(media(semana.map((d) => d.suenoMin))),
  }
}

/** Masa libre de grasa: peso × (1 − grasa). */
export function masaLibre(pesoKg: number, grasaPct: number): number {
  return redondear(pesoKg * (1 - grasaPct / 100))
}

/** Años cumplidos en `fecha`. */
export function edadEn(nacimiento: string, fecha: string): number {
  const [an, mn, dn] = nacimiento.split("-").map(Number) as [number, number, number]
  const [a, m, d] = fecha.split("-").map(Number) as [number, number, number]
  return a - an - (m < mn || (m === mn && d < dn) ? 1 : 0)
}
