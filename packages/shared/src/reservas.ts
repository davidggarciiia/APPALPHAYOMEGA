import { z } from "zod"
import { ServicioDisponibleSchema, MesBonoSchema } from "./bonos"
import { ConsultarHuecosSchema } from "./disponibilidad"
import { FechaAgendaSchema } from "./agenda"

const ServicioOfrecidoSchema = ServicioDisponibleSchema.shape.id
export const AsignarReservaSchema = z.strictObject({
  operacionId: z.uuid(),
  huecoId: z.uuid(),
  clienteId: z.uuid(),
  servicio: ServicioOfrecidoSchema,
})
export type AsignarReserva = z.infer<typeof AsignarReservaSchema>
export const CancelarReservaSchema = z.strictObject({ devolver: z.boolean() })
export type CancelarReserva = z.infer<typeof CancelarReservaSchema>
export const MarcarAsistenciaReservaSchema = z.strictObject({ asistio: z.boolean() })
export type MarcarAsistenciaReserva = z.infer<typeof MarcarAsistenciaReservaSchema>
export const ConsultarReservasSchema = ConsultarHuecosSchema
export type ConsultarReservas = z.infer<typeof ConsultarReservasSchema>

export const ReservaSchema = z.strictObject({
  id: z.uuid(),
  huecoId: z.uuid(),
  clienteId: z.uuid(),
  entrenadorId: z.uuid(),
  servicio: ServicioOfrecidoSchema,
  fecha: FechaAgendaSchema,
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  inicioEn: z.iso.datetime(),
  finEn: z.iso.datetime(),
  duracionMinutos: z.number().int().positive().max(480),
  cantidadConsumida: z.number().int().positive().max(480),
  mesCupo: MesBonoSchema.nullable(),
  estado: z.enum(["confirmada", "cancelada"]),
  creadaEn: z.iso.datetime(),
  canceladaEn: z.iso.datetime().nullable(),
  devuelto: z.boolean(),
  asistio: z.boolean().nullable(),
  asistenciaEn: z.iso.datetime().nullable(),
})
export type Reserva = z.infer<typeof ReservaSchema>
export const ListadoReservasSchema = z.strictObject({
  reservas: z.array(ReservaSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoReservas = z.infer<typeof ListadoReservasSchema>

export const ConsultarAvisosReservaSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarAvisosReserva = z.infer<typeof ConsultarAvisosReservaSchema>
export const AvisoReservaSchema = z.strictObject({
  id: z.uuid(),
  reservaId: z.uuid(),
  clienteId: z.uuid(),
  tipo: z.enum(["asignada", "cancelada"]),
  servicio: ServicioOfrecidoSchema,
  fecha: FechaAgendaSchema,
  horaInicio: z.string(),
  duracionMinutos: z.number().int().positive(),
  creadaEn: z.iso.datetime(),
  leidaEn: z.iso.datetime().nullable(),
})
export type AvisoReserva = z.infer<typeof AvisoReservaSchema>
export const ListadoAvisosReservaSchema = z.strictObject({
  avisos: z.array(AvisoReservaSchema),
  total: z.number().int().nonnegative(),
  sinLeer: z.number().int().nonnegative(),
})
export type ListadoAvisosReserva = z.infer<typeof ListadoAvisosReservaSchema>
