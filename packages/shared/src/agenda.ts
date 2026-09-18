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
