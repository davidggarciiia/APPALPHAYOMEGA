import { z } from "zod"

export const ZONA_AGENDA = "Europe/Madrid"
export const FechaAgendaSchema = z.iso.date()
export const RevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

export const SemanaSchema = FechaAgendaSchema.refine(
  (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay() === 1,
  "La semana se identifica por su lunes",
)
export const ConsultarSemanaSchema = z.strictObject({ semana: SemanaSchema })
export type ConsultarSemana = z.infer<typeof ConsultarSemanaSchema>

export const CambiarFechaSchema = z.strictObject({
  fecha: FechaAgendaSchema,
  revision: RevisionSchema,
})
export type CambiarFecha = z.infer<typeof CambiarFechaSchema>

export const SesionProgramadaSchema = z.strictObject({
  id: z.uuid(),
  clienteId: z.uuid(),
  fechaOriginal: FechaAgendaSchema,
  fechaActual: FechaAgendaSchema,
  estado: z.enum(["abierta", "cerrada"]),
  revision: RevisionSchema,
})
export type SesionProgramada = z.infer<typeof SesionProgramadaSchema>

export const CambioDeFechaSchema = z.strictObject({
  id: z.uuid(),
  sesionId: z.uuid(),
  fechaAnterior: FechaAgendaSchema,
  fechaNueva: FechaAgendaSchema,
  autorId: z.uuid(),
  cambiadoEn: z.iso.datetime(),
})
export type CambioDeFecha = z.infer<typeof CambioDeFechaSchema>

export const ListadoCambiosDeFechaSchema = z.strictObject({
  cambios: z.array(CambioDeFechaSchema),
})
export type ListadoCambiosDeFecha = z.infer<typeof ListadoCambiosDeFechaSchema>

/*
 * Aritmética de días de calendario.
 *
 * Una fecha de agenda es un día, no un instante. Se opera siempre en UTC sobre
 * la medianoche de ese día para que ni la zona del teléfono ni la del servidor
 * muevan la fecha: en `Europe/Madrid` un `new Date(2026, 2, 29)` local y un
 * cambio de hora bastan para saltar al día anterior.
 */
const MS_POR_DIA = 24 * 60 * 60 * 1000

function aInstante(fecha: string): number {
  return Date.parse(`${fecha}T00:00:00.000Z`)
}

function deInstante(instante: number): string {
  return new Date(instante).toISOString().slice(0, 10)
}

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  return deInstante(aInstante(fecha) + dias * MS_POR_DIA)
}

/** Día de la semana de 1 (lunes) a 7 (domingo). */
export function diaSemanaDe(fecha: string): number {
  const domingoCero = new Date(aInstante(fecha)).getUTCDay()
  return domingoCero === 0 ? 7 : domingoCero
}

/** El lunes de la semana a la que pertenece la fecha. */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemanaDe(fecha))
}

/** Si dos fechas caen en la misma semana de lunes a domingo. */
export function mismaSemana(una: string, otra: string): boolean {
  return lunesDe(una) === lunesDe(otra)
}

/** Días completos de `desde` a `hasta`; negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aInstante(hasta) - aInstante(desde)) / MS_POR_DIA)
}

/**
 * La fecha de hoy en la zona de la agenda, no en la del dispositivo.
 *
 * Se arma con `formatToParts` en lugar de fiarse del formato de un idioma
 * concreto: el orden de día, mes y año depende del motor de Intl del teléfono.
 */
export function hoyEn(zona: string = ZONA_AGENDA, ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora)
  const valor = (tipo: string): string => partes.find((parte) => parte.type === tipo)?.value ?? ""
  return `${valor("year")}-${valor("month")}-${valor("day")}`
}
