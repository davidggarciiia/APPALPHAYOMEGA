import { z } from "zod"
import { FechaAgendaSchema } from "./agenda"

/**
 * Seguimiento del cliente del diseño: el registro de cada día (peso en ayunas,
 * pasos, sueño y creatina), las medidas corporales y las pruebas físicas.
 */

const Decimal = (min: number, max: number) =>
  z
    .number()
    .min(min)
    .max(max)
    .refine(
      (valor) => Math.abs(valor * 10 - Math.round(valor * 10)) < 1e-9,
      "Un decimal como máximo",
    )

export const PesoCorporalSchema = Decimal(30, 400)
export const PasosSchema = z.number().int().min(0).max(100_000)
/** Minutos dormidos: «7 h 40» son 460. */
export const SuenoSchema = z.number().int().min(0).max(1440)

export const DiaDeSeguimientoSchema = z.strictObject({
  fecha: FechaAgendaSchema,
  pesoKg: PesoCorporalSchema.nullable(),
  pasos: PasosSchema.nullable(),
  suenoMin: SuenoSchema.nullable(),
  creatina: z.boolean().nullable(),
})
export type DiaDeSeguimiento = z.infer<typeof DiaDeSeguimientoSchema>

/** Lo que cambia el cliente en un día: solo los campos que envía; `null` borra. */
export const CambiarDiaSchema = z
  .strictObject({
    pesoKg: PesoCorporalSchema.nullable().optional(),
    pasos: PasosSchema.nullable().optional(),
    suenoMin: SuenoSchema.nullable().optional(),
    creatina: z.boolean().nullable().optional(),
  })
  .refine((cambio) => Object.keys(cambio).length > 0, "Indica qué quieres guardar")
export type CambiarDia = z.infer<typeof CambiarDiaSchema>

const MAX_DIAS_CONSULTA = 400
export const ConsultarPeriodoSchema = z
  .strictObject({ desde: FechaAgendaSchema, hasta: FechaAgendaSchema })
  .refine((p) => p.desde <= p.hasta, "El periodo no puede acabar antes de empezar")
  .refine(
    (p) => (Date.parse(p.hasta) - Date.parse(p.desde)) / 86_400_000 <= MAX_DIAS_CONSULTA,
    "Consulta como máximo 400 días",
  )
export type ConsultarPeriodo = z.infer<typeof ConsultarPeriodoSchema>

export const ListadoDiasSchema = z.strictObject({ dias: z.array(DiaDeSeguimientoSchema) })
export type ListadoDias = z.infer<typeof ListadoDiasSchema>

const CamposMedida = {
  pesoKg: PesoCorporalSchema.nullable(),
  cinturaCm: Decimal(30, 300).nullable(),
  grasaPct: Decimal(2, 70).nullable(),
  alturaCm: z.number().int().min(100).max(250).nullable(),
}
const conAlgunValor = (m: Record<keyof typeof CamposMedida, number | null>): boolean =>
  Object.keys(CamposMedida).some((k) => m[k as keyof typeof CamposMedida] !== null)

export const RegistrarMedidaSchema = z
  .strictObject({ operacionId: z.uuid(), fecha: FechaAgendaSchema, ...CamposMedida })
  .refine(conAlgunValor, "Escribe al menos una medida")
export type RegistrarMedida = z.infer<typeof RegistrarMedidaSchema>

export const MedidaSchema = z.strictObject({
  id: z.uuid(),
  fecha: FechaAgendaSchema,
  ...CamposMedida,
  creadoEn: z.iso.datetime(),
})
export type Medida = z.infer<typeof MedidaSchema>

export const ListadoMedidasSchema = z.strictObject({
  medidas: z.array(MedidaSchema),
  /** Del perfil del cliente, para «Altura y edad». */
  fechaNacimiento: FechaAgendaSchema.nullable(),
})
export type ListadoMedidas = z.infer<typeof ListadoMedidasSchema>

export const RegistrarPruebaSchema = z.strictObject({
  operacionId: z.uuid(),
  fecha: FechaAgendaSchema,
  /** «Flexiones seguidas», «Plancha», «Salto vertical». */
  nombre: z.string().trim().min(1).max(60),
  valor: z.number().min(0).max(100_000),
  /** «reps», «s», «cm», «kg». */
  unidad: z.string().trim().min(1).max(12),
})
export type RegistrarPrueba = z.infer<typeof RegistrarPruebaSchema>

export const PruebaFisicaSchema = z.strictObject({
  id: z.uuid(),
  fecha: FechaAgendaSchema,
  nombre: z.string(),
  valor: z.number(),
  unidad: z.string(),
  creadoEn: z.iso.datetime(),
})
export type PruebaFisica = z.infer<typeof PruebaFisicaSchema>

export const ListadoPruebasSchema = z.strictObject({ pruebas: z.array(PruebaFisicaSchema) })
export type ListadoPruebas = z.infer<typeof ListadoPruebasSchema>

/** Mejor serie de un ejercicio en una sesión enviada, para «Fuerza». */
export const PuntoDeFuerzaSchema = z.strictObject({
  fecha: FechaAgendaSchema,
  pesoKg: z.number(),
  repeticiones: z.number().int(),
  /** Estimación de Epley: peso × (1 + reps / 30). */
  estimado: z.number(),
})
export const ProgresionFuerzaSchema = z.strictObject({
  ejercicios: z.array(
    z.strictObject({
      ejercicioId: z.uuid(),
      nombre: z.string(),
      puntos: z.array(PuntoDeFuerzaSchema),
    }),
  ),
})
export type ProgresionFuerza = z.infer<typeof ProgresionFuerzaSchema>
