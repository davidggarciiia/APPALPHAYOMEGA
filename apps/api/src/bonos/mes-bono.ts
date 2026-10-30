import { ZONA_AGENDA } from "@alpha-omega/shared"

const formatoMes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_AGENDA,
  year: "numeric",
  month: "2-digit",
})

export function mesBono(fecha: Date): string {
  const partes = Object.fromEntries(
    formatoMes.formatToParts(fecha).map(({ type, value }) => [type, value]),
  )
  return `${partes.year}-${partes.month}`
}
