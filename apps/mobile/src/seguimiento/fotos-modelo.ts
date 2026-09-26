import type { MedioFoto, VistaFoto } from "@alpha-omega/shared"

import { fechaCorta } from "../entrenamiento/plan/modelo"

export type VistaEstandar = Exclude<VistaFoto, "otra">

/** Nombre completo, para etiquetas y lectores de pantalla. */
export const NOMBRE_DE_VISTA: Record<VistaEstandar, string> = {
  frente: "Frente",
  espalda: "Espalda",
  perfilIzquierdo: "Perfil izquierdo",
  perfilDerecho: "Perfil derecho",
}

/** Lo que cabe en una píldora o bajo una miniatura. */
export const NOMBRE_CORTO: Record<VistaEstandar, string> = {
  frente: "Frente",
  espalda: "Espalda",
  perfilIzquierdo: "Perfil izq.",
  perfilDerecho: "Perfil der.",
}

export const VISTAS_ESTANDAR = Object.keys(NOMBRE_DE_VISTA) as VistaEstandar[]

/** «24 sep 2026»: entre fotos pasan meses, así que el año cuenta. */
export const fechaConAno = (dia: string): string => `${fechaCorta(dia)} ${dia.slice(0, 4)}`

/** Días de calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  )
}

/** «Hoy», «Ayer», «Hace 84 días». Una fecha posterior a hoy se dice tal cual. */
export function haceDias(fecha: string, hoy: string): string {
  const dias = diasEntre(fecha, hoy)
  if (dias === 0) return "Hoy"
  if (dias === 1) return "Ayer"
  if (dias < 0) return dias === -1 ? "Mañana" : `Dentro de ${-dias} días`
  return `Hace ${dias} días`
}

/** «84 días entre las dos fotos»; si son del mismo día, `null` (se explica aparte). */
export function separacion(a: string, b: string): string | null {
  const dias = Math.abs(diasEntre(a, b))
  if (dias === 0) return null
  return `${dias} ${dias === 1 ? "día" : "días"} entre las dos fotos`
}

/** Nombre de la vista de una foto: «Frente» o la etiqueta de «otra». */
export const vistaDe = (foto: Pick<MedioFoto, "vista" | "etiqueta">): string =>
  foto.vista === "otra" ? (foto.etiqueta ?? "Otra") : NOMBRE_DE_VISTA[foto.vista]

const ORDEN: VistaFoto[] = [...VISTAS_ESTANDAR, "otra"]

export type DiaDeFotos = { fecha: string; fotos: MedioFoto[] }

/**
 * Las fotos que se pueden ver, agrupadas por día de toma: el día más reciente
 * primero y, dentro del día, en el orden de las vistas. Las pendientes y las
 * retiradas no se enseñan en la galería.
 */
export function fotosPorDia(fotos: readonly MedioFoto[]): DiaDeFotos[] {
  const dias = new Map<string, MedioFoto[]>()
  for (const foto of fotos) {
    if (foto.estado !== "disponible") continue
    dias.set(foto.fechaToma, [...(dias.get(foto.fechaToma) ?? []), foto])
  }
  return [...dias.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([fecha, delDia]) => ({
      fecha,
      fotos: delDia.sort(
        (a, b) =>
          ORDEN.indexOf(a.vista) - ORDEN.indexOf(b.vista) ||
          (a.etiqueta ?? "").localeCompare(b.etiqueta ?? "", "es") ||
          a.creadoEn.localeCompare(b.creadoEn),
      ),
    }))
}

/** Fecha escrita a mano: AAAA-MM-DD real y no posterior a hoy. */
export function fechaDeTomaValida(texto: string, hoy: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [a, m, d] = texto.split("-").map(Number) as [number, number, number]
  const fecha = new Date(Date.UTC(a, m - 1, d))
  const real =
    fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d
  return real && texto <= hoy
}
