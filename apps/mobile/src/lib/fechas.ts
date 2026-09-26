import { diaSemanaDe, sumarDias } from "@alpha-omega/shared"

/*
 * Fechas de la agenda en palabras.
 *
 * Nunca `new Date(fecha).toLocale...`: eso interpreta la fecha en la zona del
 * teléfono y puede enseñar el día anterior. Aquí todo sale del texto AAAA-MM-DD.
 */

const DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const
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
] as const

function partes(fecha: string): { año: number; mes: number; dia: number } {
  const [año, mes, dia] = fecha.split("-").map(Number)
  return { año: año ?? 0, mes: mes ?? 1, dia: dia ?? 1 }
}

export function nombreDelDia(fecha: string): string {
  return DIAS[diaSemanaDe(fecha) - 1] ?? ""
}

/** «lunes 14 de septiembre» */
export function fechaLarga(fecha: string): string {
  const { mes, dia } = partes(fecha)
  return `${nombreDelDia(fecha)} ${String(dia)} de ${MESES[mes - 1] ?? ""}`
}

/** «lun 14» */
export function fechaCorta(fecha: string): string {
  return `${nombreDelDia(fecha).slice(0, 3)} ${String(partes(fecha).dia)}`
}

/** «14 – 20 sep 2026» o «28 dic – 3 ene 2027» */
export function rangoDeSemana(lunes: string): string {
  const domingo = sumarDias(lunes, 6)
  const a = partes(lunes)
  const b = partes(domingo)
  const mesA = (MESES[a.mes - 1] ?? "").slice(0, 3)
  const mesB = (MESES[b.mes - 1] ?? "").slice(0, 3)
  const inicio = a.mes === b.mes ? String(a.dia) : `${String(a.dia)} ${mesA}`
  return `${inicio} – ${String(b.dia)} ${mesB} ${String(b.año)}`
}

/** Los siete días de la semana que empieza en `lunes`. */
export function diasDeLaSemana(lunes: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dias) => sumarDias(lunes, dias))
}

/** Un instante ISO en hora de Madrid: «14/09 a las 18:32». */
export function momento(iso: string): string {
  const formato = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso))
  // El relleno a dos cifras se hace aquí: no todos los motores de Intl lo respetan.
  const valor = (tipo: string): string =>
    (formato.find((p) => p.type === tipo)?.value ?? "").padStart(2, "0")
  return `${valor("day")}/${valor("month")} a las ${valor("hour")}:${valor("minute")}`
}

export function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
