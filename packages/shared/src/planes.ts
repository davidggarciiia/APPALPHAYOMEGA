import { z } from "zod"

import { FechaAgendaSchema } from "./agenda"
import { ClaseSaldoSchema } from "./reservas"

/**
 * Productos, saldo, solicitudes y cobros (SPEC-planes.md).
 *
 * Importes en céntimos. El saldo se deriva de lo concedido y de los movimientos:
 * no hay contadores que se desincronicen ni tareas que caduquen cosas.
 */

const InstanteSchema = z.iso.datetime({ offset: true })
/** Primer día de un mes: `2026-10-01`. */
export const MesSchema = FechaAgendaSchema.refine((f) => f.endsWith("-01"), "Indica el día 1")
const CentimosSchema = z.number().int().min(0).max(10_000_000)

export const TIPOS_PRODUCTO = ["plan", "bono", "matricula"] as const
export const TipoProductoSchema = z.enum(TIPOS_PRODUCTO)
export type TipoProducto = z.infer<typeof TipoProductoSchema>

export const ProductoSchema = z.strictObject({
  id: z.uuid(),
  codigo: z.string(),
  tipo: TipoProductoSchema,
  clase: ClaseSaldoSchema.nullable(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precioCentimos: CentimosSchema,
  /** Plan: sesiones de la clase que da cada mes. */
  sesionesPorMes: z.number().int().nonnegative().nullable(),
  /** Plan de boxeo: clases por semana. */
  clasesPorSemana: z.number().int().nonnegative().nullable(),
  meses: z.number().int().positive().nullable(),
  /** Bono: sesiones que incluye. */
  sesiones: z.number().int().positive().nullable(),
  /** Bono: días de validez desde la primera sesión. */
  validezDias: z.number().int().positive().nullable(),
  regalo: z.string().nullable(),
  visibleParaCliente: z.boolean(),
  activo: z.boolean(),
})
export type Producto = z.infer<typeof ProductoSchema>

export const ListadoProductosSchema = z.strictObject({ productos: z.array(ProductoSchema) })
export type ListadoProductos = z.infer<typeof ListadoProductosSchema>

export const CambiosProductoSchema = z
  .strictObject({
    precioCentimos: CentimosSchema.optional(),
    visibleParaCliente: z.boolean().optional(),
    activo: z.boolean().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, "Indica algún cambio")
export type CambiosProducto = z.infer<typeof CambiosProductoSchema>

export const BonoSaldoSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string(),
  clase: ClaseSaldoSchema,
  sesiones: z.number().int().nonnegative(),
  quedan: z.number().int().nonnegative(),
  primerUsoEn: FechaAgendaSchema.nullable(),
  caducaEn: FechaAgendaSchema.nullable(),
  /** Sesión suelta creada al devolver algo cuya fuente ya no servía. */
  compensacion: z.boolean(),
})
export type BonoSaldo = z.infer<typeof BonoSaldoSchema>

export const SuscripcionSaldoSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string(),
  clase: ClaseSaldoSchema,
  sesionesPorMes: z.number().int().nonnegative(),
  mesInicio: MesSchema,
  /** Último mes cubierto, incluido. */
  mesFin: MesSchema,
})
export type SuscripcionSaldo = z.infer<typeof SuscripcionSaldoSchema>

export const CupoMesSchema = z.strictObject({
  mes: MesSchema,
  cupo: z.number().int().nonnegative(),
  usadas: z.number().int().nonnegative(),
  quedan: z.number().int().nonnegative(),
})
export type CupoMes = z.infer<typeof CupoMesSchema>

export const ResumenSaldoSchema = z.strictObject({
  clienteId: z.uuid(),
  /** Fecha local a la que se refiere el resumen. */
  fecha: FechaAgendaSchema,
  ep: z.strictObject({
    /** Cupo del plan este mes, si hay plan. */
    mesActual: CupoMesSchema.nullable(),
    /** Cupo del mes siguiente, si hay plan que lo cubre. */
    mesSiguiente: CupoMesSchema.nullable(),
    bonos: z.array(BonoSaldoSchema),
    /** Sesiones utilizables hoy: plan de este mes + bonos vigentes. */
    disponibles: z.number().int().nonnegative(),
  }),
  suscripciones: z.array(SuscripcionSaldoSchema),
})
export type ResumenSaldo = z.infer<typeof ResumenSaldoSchema>

export const MOTIVOS_MOVIMIENTO = ["consumo", "devolucion", "ajuste"] as const
export const MovimientoSaldoSchema = z.strictObject({
  id: z.uuid(),
  cantidad: z.number().int(),
  motivo: z.enum(MOTIVOS_MOVIMIENTO),
  fuente: z.string(),
  origenTipo: z.string(),
  origenId: z.string(),
  creadoEn: InstanteSchema,
})
export type MovimientoSaldo = z.infer<typeof MovimientoSaldoSchema>

export const DetalleSaldoSchema = z.strictObject({
  resumen: ResumenSaldoSchema,
  movimientos: z.array(MovimientoSaldoSchema),
})
export type DetalleSaldo = z.infer<typeof DetalleSaldoSchema>

export const ESTADOS_SOLICITUD = ["pendiente", "activada", "rechazada", "anulada"] as const
export const EstadoSolicitudSchema = z.enum(ESTADOS_SOLICITUD)
export type EstadoSolicitud = z.infer<typeof EstadoSolicitudSchema>

const PersonaSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string(),
  apellidos: z.string().nullable(),
})

export const SolicitudProductoSchema = z.strictObject({
  id: z.uuid(),
  producto: z.strictObject({ id: z.uuid(), nombre: z.string(), tipo: TipoProductoSchema }),
  cliente: PersonaSchema,
  /** Precio copiado al pedirlo. */
  precioCentimos: CentimosSchema,
  estado: EstadoSolicitudSchema,
  creadaEn: InstanteSchema,
  resueltaEn: InstanteSchema.nullable(),
})
export type SolicitudProducto = z.infer<typeof SolicitudProductoSchema>

export const ListadoSolicitudesSchema = z.strictObject({
  solicitudes: z.array(SolicitudProductoSchema),
})
export type ListadoSolicitudes = z.infer<typeof ListadoSolicitudesSchema>

export const PedirProductoSchema = z.strictObject({
  operacionId: z.uuid(),
  productoId: z.uuid(),
})
export type PedirProducto = z.infer<typeof PedirProductoSchema>

export const MESES_INICIO = ["actual", "siguiente"] as const

export const ActivarSolicitudSchema = z.strictObject({
  importeCentimos: CentimosSchema,
  mesInicio: z.enum(MESES_INICIO).default("actual"),
  /** Si ya se cobró en efectivo. Si no, el cobro queda pendiente. */
  cobrado: z.boolean().default(true),
})
export type ActivarSolicitud = z.infer<typeof ActivarSolicitudSchema>

export const ActivarProductoSchema = ActivarSolicitudSchema.extend({
  operacionId: z.uuid(),
  productoId: z.uuid(),
})
export type ActivarProducto = z.infer<typeof ActivarProductoSchema>

export const ESTADOS_COBRO = ["pendiente", "cobrado", "anulado"] as const
export const EstadoCobroSchema = z.enum(ESTADOS_COBRO)
export type EstadoCobro = z.infer<typeof EstadoCobroSchema>

export const CobroSchema = z.strictObject({
  id: z.uuid(),
  cliente: PersonaSchema,
  concepto: z.string(),
  importeCentimos: CentimosSchema,
  estado: EstadoCobroSchema,
  origenTipo: z.enum(["producto", "reserva", "manual"]),
  cobradoEn: InstanteSchema.nullable(),
  creadoEn: InstanteSchema,
})
export type Cobro = z.infer<typeof CobroSchema>

export const ActivacionProductoSchema = z.strictObject({
  solicitudId: z.uuid().nullable(),
  saldo: ResumenSaldoSchema,
  cobro: CobroSchema,
})
export type ActivacionProducto = z.infer<typeof ActivacionProductoSchema>

export const ConsultarCobrosSchema = z.strictObject({
  estado: EstadoCobroSchema.optional(),
  clienteId: z.uuid().optional(),
  limite: z.coerce.number().int().min(1).max(200).default(100),
})
export type ConsultarCobros = z.infer<typeof ConsultarCobrosSchema>

export const ListadoCobrosSchema = z.strictObject({ cobros: z.array(CobroSchema) })
export type ListadoCobros = z.infer<typeof ListadoCobrosSchema>

export const ConsultarResumenCobrosSchema = z.strictObject({ mes: MesSchema })
export type ConsultarResumenCobros = z.infer<typeof ConsultarResumenCobrosSchema>

export const ResumenCobrosSchema = z.strictObject({
  mes: MesSchema,
  /** Lo cobrado dentro de ese mes. */
  cobradoCentimos: z.number().int().nonnegative(),
  cobrados: z.array(CobroSchema),
  /** Todo lo pendiente, sea del mes que sea. */
  pendienteCentimos: z.number().int().nonnegative(),
  pendientes: z.array(CobroSchema),
})
export type ResumenCobros = z.infer<typeof ResumenCobrosSchema>
