import {
  ZONA_AGENDA,
  diaSemanaFecha,
  horaDeMinutos,
  partesLocales,
  type PartesLocales,
} from "@alpha-omega/shared"

/**
 * Textos de fechas, horas e importes de reservas y saldo.
 *
 * Las horas salen siempre en `Europe/Madrid` (`ZONA_AGENDA`), nunca en la zona
 * del teléfono: un cliente de viaje tiene que ver la hora a la que se presenta
 * en el centro. Los nombres de días y meses van escritos aquí y no con `Intl` en
 * español, que Hermes no garantiza en todos los dispositivos.
 */

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
const DIAS_CORTOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

/** Fecha, minutos y día de la semana de un instante ISO en la hora del centro. */
export function local(instante: string): PartesLocales {
  return partesLocales(new Date(instante), ZONA_AGENDA)
}

/** `2026-10-06T10:00:00+02:00` → `"10:00"`. */
export function horaDe(instante: string): string {
  return horaDeMinutos(local(instante).minutos)
}

/** «10:00 – 11:00». */
export function tramo({ inicio, fin }: { inicio: string; fin: string }): string {
  return `${horaDe(inicio)} – ${horaDe(fin)}`
}

/** `2026-10-06` → «martes 6 de octubre». */
export function fechaLarga(fecha: string): string {
  const [, mes, dia] = fecha.split("-").map(Number) as [number, number, number]
  return `${DIAS[diaSemanaFecha(fecha) - 1] ?? ""} ${String(dia)} de ${MESES[mes - 1] ?? ""}`
}

/** «Martes 6 de octubre», para empezar una frase. */
export function fechaTitulo(fecha: string): string {
  const larga = fechaLarga(fecha)
  return larga.charAt(0).toUpperCase() + larga.slice(1)
}

/** `2026-10-06` → «MAR». */
export function diaCorto(fecha: string): string {
  return DIAS_CORTOS[diaSemanaFecha(fecha) - 1] ?? ""
}

/** `2026-10-06` → «6». */
export function numeroDia(fecha: string): string {
  return String(Number(fecha.slice(8, 10)))
}

/** `2026-10-06` → «6 oct». */
export function fechaCorta(fecha: string): string {
  return `${numeroDia(fecha)} ${(MESES[Number(fecha.slice(5, 7)) - 1] ?? "").slice(0, 3)}`
}

/** `2026-10-01` → «octubre de 2026». */
export function nombreMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1] ?? ""} de ${mes.slice(0, 4)}`
}

/** `2026-10-01` → «octubre». */
export function soloMes(mes: string): string {
  return MESES[Number(mes.slice(5, 7)) - 1] ?? ""
}

/** «martes 6 de octubre a las 10:00». */
export function momento(instante: string): string {
  const partes = local(instante)
  return `${fechaLarga(partes.fecha)} a las ${horaDeMinutos(partes.minutos)}`
}

/** Céntimos a euros: 3500 → «35 €», 1250 → «12,50 €», 1200000 → «12.000 €». */
export function euros(centimos: number): string {
  const enteros = Math.floor(centimos / 100)
  const resto = centimos % 100
  // Como la RAE: el separador de miles solo a partir de cinco cifras.
  const texto =
    enteros >= 10_000 ? enteros.toString().replace(/\B(?=(\d{3})+$)/g, ".") : String(enteros)
  return resto === 0 ? `${texto} €` : `${texto},${String(resto).padStart(2, "0")} €`
}

/** Lo que se escribe en un campo de importe: «35», «12,50» o «12.5» → céntimos. */
export function centimosDe(texto: string): number | null {
  const limpio = texto.replace(/\s|€/g, "").replace(",", ".")
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(limpio)) return null
  return Math.round(Number(limpio) * 100)
}

/** Céntimos al texto de un campo de importe: 1250 → «12,50», 3500 → «35». */
export function textoImporte(centimos: number): string {
  return euros(centimos).replace(" €", "").replace(".", "")
}

/** «1 sesión», «3 sesiones». */
export function sesiones(n: number): string {
  return `${String(n)} ${n === 1 ? "sesión" : "sesiones"}`
}

/** «1 persona», «3 personas». */
export function personas(n: number): string {
  return `${String(n)} ${n === 1 ? "persona" : "personas"}`
}

export function nombreDe(persona: { nombre: string; apellidos: string | null }): string {
  return [persona.nombre, persona.apellidos].filter(Boolean).join(" ")
}
