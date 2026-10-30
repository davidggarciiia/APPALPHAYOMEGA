import { z } from "zod"

export const ServicioReservaSchema = z.enum(["entrenoPersonal", "seguimiento", "quiromasaje"])
export type ServicioReserva = z.infer<typeof ServicioReservaSchema>

/** Quiromasaje queda en el modelo; solo se ofrecen bonos de entreno personal. */
export const ServicioConBonoSchema = z.literal("entrenoPersonal")
export type ServicioConBono = z.infer<typeof ServicioConBonoSchema>

export const ServicioDisponibleSchema = z.strictObject({
  id: ServicioReservaSchema.exclude(["quiromasaje"]),
  nombre: z.string(),
  unidad: z.enum(["creditos", "minutos"]),
})
export type ServicioDisponible = z.infer<typeof ServicioDisponibleSchema>

export const ListadoServiciosReservaSchema = z.strictObject({
  servicios: z.array(ServicioDisponibleSchema),
})
export type ListadoServiciosReserva = z.infer<typeof ListadoServiciosReservaSchema>

export const CargarBonoSchema = z.strictObject({
  operacionId: z.uuid(),
  servicio: ServicioConBonoSchema,
  creditos: z.number().int().positive().max(1_000_000),
  nota: z.string().trim().min(1).max(1000).nullable().optional(),
})
export type CargarBono = z.infer<typeof CargarBonoSchema>

export const AjustarBonoSchema = z.strictObject({
  operacionId: z.uuid(),
  servicio: ServicioConBonoSchema,
  creditos: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((cantidad) => cantidad !== 0),
  motivo: z.string().trim().min(1).max(1000),
})
export type AjustarBono = z.infer<typeof AjustarBonoSchema>

export const CambiarSeguimientoActivoSchema = z.strictObject({ activo: z.boolean() })
export type CambiarSeguimientoActivo = z.infer<typeof CambiarSeguimientoActivoSchema>

export const MesBonoSchema = z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
export type MesBono = z.infer<typeof MesBonoSchema>

export const MovimientoBonoSchema = z
  .strictObject({
    id: z.uuid(),
    clienteId: z.uuid(),
    autorId: z.uuid(),
    operacionId: z.uuid(),
    servicio: ServicioReservaSchema,
    tipo: z.enum(["carga", "consumo", "devolucion", "ajuste"]),
    cantidad: z
      .number()
      .int()
      .refine((cantidad) => cantidad !== 0),
    mes: MesBonoSchema.nullable(),
    nota: z.string().nullable(),
    creadoEn: z.iso.datetime(),
  })
  .refine(
    ({ tipo, cantidad }) => tipo === "ajuste" || (tipo === "consumo" ? cantidad < 0 : cantidad > 0),
    { message: "El signo de la cantidad no corresponde al tipo de movimiento", path: ["cantidad"] },
  )
  .refine(({ servicio, mes }) => (servicio === "seguimiento") === (mes !== null), {
    message: "El mes se indica solo para seguimiento",
    path: ["mes"],
  })
  .refine(
    ({ servicio, tipo, cantidad }) =>
      servicio !== "seguimiento" || tipo !== "carga" || cantidad === 120,
    { message: "La carga mensual de seguimiento debe ser de 120 minutos", path: ["cantidad"] },
  )
export type MovimientoBono = z.infer<typeof MovimientoBonoSchema>

export const SaldoBonosSchema = z.strictObject({
  clienteId: z.uuid(),
  saldos: z.array(
    z.strictObject({
      servicio: ServicioConBonoSchema,
      creditos: z.number().int().nonnegative(),
    }),
  ),
  seguimiento: z.strictObject({
    activo: z.boolean(),
    mes: MesBonoSchema,
    minutosDisponibles: z.number().int().min(0).max(120),
  }),
})
export type SaldoBonos = z.infer<typeof SaldoBonosSchema>

export const ConsultarMovimientosBonoSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarMovimientosBono = z.infer<typeof ConsultarMovimientosBonoSchema>

export const ListadoMovimientosBonoSchema = z.strictObject({
  movimientos: z.array(MovimientoBonoSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoMovimientosBono = z.infer<typeof ListadoMovimientosBonoSchema>
