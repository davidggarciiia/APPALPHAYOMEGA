import { ZONA_AGENDA } from "@alpha-omega/shared"

export function hoyAgenda(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_AGENDA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const parte = (tipo: string): string => partes.find((p) => p.type === tipo)!.value
  return `${parte("year")}-${parte("month")}-${parte("day")}`
}
export function sumarDias(fecha: string, dias: number): string {
  const calendario = new Date(`${fecha}T00:00:00Z`)
  calendario.setUTCDate(calendario.getUTCDate() + dias)
  return calendario.toISOString().slice(0, 10)
}
export function lunesDeSemana(fecha = hoyAgenda()): string {
  return sumarDias(fecha, -((new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7))
}
export function fechaLegible(fecha: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${fecha}T00:00:00Z`))
}
