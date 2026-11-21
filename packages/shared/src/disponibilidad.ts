import { z } from "zod"
import { FechaAgendaSchema } from "./agenda"
import { ServicioDisponibleSchema } from "./bonos"

const FechaHuecoSchema = FechaAgendaSchema.refine((fecha) => !fecha.startsWith("0000-"))
const HoraHuecoSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const DuracionHuecoSchema = z.number().int().min(1).max(480)
const ServiciosHuecoSchema = z
  .array(ServicioDisponibleSchema.shape.id)
  .min(1)
  .max(2)
  .refine((servicios) => new Set(servicios).size === servicios.length, "Servicio repetido")

/** Fecha y hora civiles en Europe/Madrid; las repeticiones mantienen esa hora. */
export const AbrirHuecosSchema = z.strictObject({
  operacionId: z.uuid(),
  fecha: FechaHuecoSchema,
  horaInicio: HoraHuecoSchema,
  duracionMinutos: DuracionHuecoSchema.default(60),
  semanas: z.number().int().min(1).max(52).default(1),
  servicios: ServiciosHuecoSchema,
})
export type AbrirHuecos = z.infer<typeof AbrirHuecosSchema>

export const ConsultarHuecosSchema = z
  .strictObject({
    desde: FechaHuecoSchema,
    hasta: FechaHuecoSchema,
    limite: z.coerce.number().int().min(1).max(100).default(100),
    desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .refine(
    ({ desde, hasta }) => {
      const dias = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000
      return dias >= 0 && dias < 366
    },
    { message: "Elige un rango de hasta 366 días en orden", path: ["hasta"] },
  )
export type ConsultarHuecos = z.infer<typeof ConsultarHuecosSchema>

export const HuecoDisponibilidadSchema = z.strictObject({
  id: z.uuid(),
  entrenadorId: z.uuid(),
  fecha: FechaHuecoSchema,
  horaInicio: HoraHuecoSchema,
  inicioEn: z.iso.datetime(),
  finEn: z.iso.datetime(),
  duracionMinutos: DuracionHuecoSchema,
  servicios: ServiciosHuecoSchema,
  estado: z.enum(["libre", "reservado", "cerrado"]),
  creadoEn: z.iso.datetime(),
  cerradoEn: z.iso.datetime().nullable(),
})
export type HuecoDisponibilidad = z.infer<typeof HuecoDisponibilidadSchema>

export const ListadoHuecosSchema = z.strictObject({
  huecos: z.array(HuecoDisponibilidadSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoHuecos = z.infer<typeof ListadoHuecosSchema>
