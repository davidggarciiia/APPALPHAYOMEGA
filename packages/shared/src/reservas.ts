import { z } from "zod"

import { FechaAgendaSchema, RevisionSchema } from "./agenda"

/**
 * Horarios y reservas (SPEC-agenda.md, «Ampliación: horarios y reservas»).
 *
 * Una reserva es una cita con hora en la agenda del entrenador; no es una
 * `SesionProgramada` de la rutina. Los instantes viajan en ISO con zona y el
 * servidor calcula los huecos en `Europe/Madrid`.
 */

const InstanteSchema = z.iso.datetime({ offset: true })

/** Clase de saldo que gasta un servicio. `null` = se paga allí, en efectivo. */
export const CLASES_SALDO = ["ep", "boxeo"] as const
export const ClaseSaldoSchema = z.enum(CLASES_SALDO)
export type ClaseSaldo = z.infer<typeof ClaseSaldoSchema>

export const TarifaGrupoSchema = z.strictObject({
  personas: z.number().int().min(2).max(6),
  precioPorPersonaCentimos: z.number().int().nonnegative(),
})
export type TarifaGrupo = z.infer<typeof TarifaGrupoSchema>

export const ServicioSchema = z.strictObject({
  id: z.uuid(),
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  duracionMin: z.number().int().positive(),
  minPersonas: z.number().int().positive(),
  maxPersonas: z.number().int().positive(),
  claseDeSaldo: ClaseSaldoSchema.nullable(),
  precioCentimos: z.number().int().nonnegative().nullable(),
  tarifas: z.array(TarifaGrupoSchema),
  reservable: z.boolean(),
  activo: z.boolean(),
})
export type Servicio = z.infer<typeof ServicioSchema>

export const ListadoServiciosSchema = z.strictObject({ servicios: z.array(ServicioSchema) })
export type ListadoServicios = z.infer<typeof ListadoServiciosSchema>

export const CambiosServicioSchema = z
  .strictObject({
    nombre: z.string().trim().min(1).max(60).optional(),
    descripcion: z.string().trim().max(200).nullable().optional(),
    duracionMin: z.number().int().min(15).max(240).optional(),
    precioCentimos: z.number().int().min(0).max(1_000_000).nullable().optional(),
    tarifas: z.array(TarifaGrupoSchema).max(5).optional(),
    reservable: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, "Indica algún cambio")
export type CambiosServicio = z.infer<typeof CambiosServicioSchema>

export const AjustesAgendaSchema = z.strictObject({
  /** Minutos mínimos entre ahora y el inicio de una reserva del cliente. */
  antelacionMin: z.number().int().min(0).max(10_080),
  /** Días máximos hacia delante que el cliente puede reservar. */
  horizonteDias: z.number().int().min(1).max(120),
  /** Horas antes del inicio hasta las que cancelar devuelve la sesión. */
  cancelacionHoras: z.number().int().min(0).max(168),
  /** Minutos entre inicios posibles. */
  intervaloMin: z.number().int().min(15).max(120),
})
export type AjustesAgenda = z.infer<typeof AjustesAgendaSchema>

export const CambiosAjustesAgendaSchema = AjustesAgendaSchema.partial()
  .strict()
  .refine((c) => Object.keys(c).length > 0, "Indica algún cambio")
export type CambiosAjustesAgenda = z.infer<typeof CambiosAjustesAgendaSchema>

export const FranjaSemanalSchema = z
  .strictObject({
    /** 1 = lunes … 7 = domingo. */
    diaSemana: z.number().int().min(1).max(7),
    /** Minutos desde medianoche local. */
    inicioMin: z.number().int().min(0).max(1439),
    finMin: z.number().int().min(1).max(1440),
  })
  .refine((f) => f.finMin > f.inicioMin, "La franja debe terminar después de empezar")
export type FranjaSemanal = z.infer<typeof FranjaSemanalSchema>

export const HorarioSemanalSchema = z
  .strictObject({ franjas: z.array(FranjaSemanalSchema).max(60) })
  .refine((h) => {
    const ordenadas = [...h.franjas].sort(
      (a, b) => a.diaSemana - b.diaSemana || a.inicioMin - b.inicioMin,
    )
    return ordenadas.every((f, i) => {
      const previa = ordenadas[i - 1]
      return !previa || previa.diaSemana !== f.diaSemana || previa.finMin <= f.inicioMin
    })
  }, "Dos franjas del mismo día no pueden solaparse")
export type HorarioSemanal = z.infer<typeof HorarioSemanalSchema>

export const TIPOS_EXCEPCION = ["cierre", "apertura"] as const
export const ExcepcionAgendaSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_EXCEPCION),
  inicio: InstanteSchema,
  fin: InstanteSchema,
  motivo: z.string().nullable(),
  creadaEn: InstanteSchema,
})
export type ExcepcionAgenda = z.infer<typeof ExcepcionAgendaSchema>

export const CrearExcepcionSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_EXCEPCION),
    inicio: InstanteSchema,
    fin: InstanteSchema,
    motivo: z.string().trim().max(120).optional(),
  })
  .refine((e) => Date.parse(e.fin) > Date.parse(e.inicio), "El fin debe ser posterior al inicio")
  .refine(
    (e) => Date.parse(e.fin) - Date.parse(e.inicio) <= 62 * 86_400_000,
    "Una excepción dura como mucho dos meses",
  )
export type CrearExcepcion = z.infer<typeof CrearExcepcionSchema>

export const ListadoExcepcionesSchema = z.strictObject({
  excepciones: z.array(ExcepcionAgendaSchema),
})
export type ListadoExcepciones = z.infer<typeof ListadoExcepcionesSchema>

export const ConsultarDisponibilidadSchema = z.strictObject({
  servicioId: z.uuid(),
  desde: FechaAgendaSchema,
  dias: z.coerce.number().int().min(1).max(14).default(7),
})
export type ConsultarDisponibilidad = z.infer<typeof ConsultarDisponibilidadSchema>

export const HuecoSchema = z.strictObject({ inicio: InstanteSchema, fin: InstanteSchema })
export type Hueco = z.infer<typeof HuecoSchema>

export const DisponibilidadSchema = z.strictObject({
  servicioId: z.uuid(),
  zona: z.string(),
  dias: z.array(z.strictObject({ fecha: FechaAgendaSchema, huecos: z.array(HuecoSchema) })),
})
export type Disponibilidad = z.infer<typeof DisponibilidadSchema>

export const ESTADOS_RESERVA = ["confirmada", "cancelada"] as const
export const EstadoReservaSchema = z.enum(ESTADOS_RESERVA)
export type EstadoReserva = z.infer<typeof EstadoReservaSchema>

export const ReservaSchema = z.strictObject({
  id: z.uuid(),
  servicio: z.strictObject({
    id: z.uuid(),
    codigo: z.string(),
    nombre: z.string(),
    duracionMin: z.number().int().positive(),
  }),
  cliente: z.strictObject({
    id: z.uuid(),
    nombre: z.string(),
    apellidos: z.string().nullable(),
  }),
  inicio: InstanteSchema,
  fin: InstanteSchema,
  personas: z.number().int().min(1).max(6),
  estado: EstadoReservaSchema,
  /** De dónde salió la sesión («Plan de octubre», «Bono EP 6»); null si no gasta saldo. */
  fuenteSaldo: z.string().nullable(),
  /** Importe total del cobro de una sesión en grupo, si lo hay. */
  cobroCentimos: z.number().int().nonnegative().nullable(),
  /** Hasta cuándo cancelar devuelve la sesión. */
  cancelarSinPerderHasta: InstanteSchema,
  cancelacion: z
    .strictObject({
      en: InstanteSchema,
      porEntrenador: z.boolean(),
      motivo: z.string().nullable(),
      sesionDevuelta: z.boolean(),
    })
    .nullable(),
  /** El entrenador devolvió la sesión a mano después (una sola vez). */
  devueltaAMano: z.boolean(),
  revision: RevisionSchema,
  creadaEn: InstanteSchema,
})
export type Reserva = z.infer<typeof ReservaSchema>

export const ReservarSchema = z.strictObject({
  operacionId: z.uuid(),
  servicioId: z.uuid(),
  inicio: InstanteSchema,
  personas: z.number().int().min(1).max(6).default(1),
})
export type Reservar = z.infer<typeof ReservarSchema>

export const CancelarReservaSchema = z.strictObject({
  motivo: z.string().trim().max(200).optional(),
})
export type CancelarReserva = z.infer<typeof CancelarReservaSchema>

export const MoverReservaSchema = z.strictObject({
  inicio: InstanteSchema,
  revision: RevisionSchema,
})
export type MoverReserva = z.infer<typeof MoverReservaSchema>

export const ConsultarReservasSchema = z
  .strictObject({ desde: FechaAgendaSchema, hasta: FechaAgendaSchema })
  .refine((c) => c.hasta >= c.desde, "hasta no puede ser anterior a desde")
  .refine(
    (c) => Date.parse(c.hasta) - Date.parse(c.desde) <= 62 * 86_400_000,
    "Consulta como mucho dos meses",
  )
export type ConsultarReservas = z.infer<typeof ConsultarReservasSchema>

export const ListadoReservasSchema = z.strictObject({ reservas: z.array(ReservaSchema) })
export type ListadoReservas = z.infer<typeof ListadoReservasSchema>

export const MisReservasSchema = z.strictObject({
  proximas: z.array(ReservaSchema),
  pasadas: z.array(ReservaSchema),
})
export type MisReservas = z.infer<typeof MisReservasSchema>

/**
 * 409 de una operación del entrenador que dejaría reservas confirmadas fuera de
 * su horario: no se aplica y devuelve cuáles son (decisión 6).
 */
export const ConflictoAgendaSchema = z.strictObject({
  statusCode: z.literal(409),
  codigo: z.literal("reservas_afectadas"),
  message: z.string(),
  conflictos: z.array(ReservaSchema),
})
export type ConflictoAgenda = z.infer<typeof ConflictoAgendaSchema>
