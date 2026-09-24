import { z } from "zod"
import { FechaAgendaSchema, RevisionSchema } from "./agenda"

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

export const IndicadorSeguimientoSchema = z.enum([
  "peso",
  "pasos",
  "sueno",
  "cintura",
  "fuerza",
  "pruebas",
])
const IndicadorRegistrableSchema = IndicadorSeguimientoSchema.extract([
  "peso",
  "pasos",
  "sueno",
  "cintura",
])
const RegistroSolicitadoSchema = z
  .strictObject({
    indicador: IndicadorRegistrableSchema,
    frecuencia: z.enum(["diaria", "semanal"]),
    /** Lunes = 1, domingo = 7. Solo corresponde a registros semanales. */
    diaSemana: z.number().int().min(1).max(7).nullable(),
  })
  .refine(
    (registro) => (registro.frecuencia === "semanal") === (registro.diaSemana !== null),
    "El día se indica solo para registros semanales",
  )
const ObjetivoPesoSchema = z.strictObject({
  direccion: z.enum(["bajar", "mantener", "subir"]),
  rangoKg: z
    .strictObject({ minimo: PesoCorporalSchema, maximo: PesoCorporalSchema })
    .refine((rango) => rango.minimo <= rango.maximo, "El rango de peso está invertido")
    .nullable(),
})
const PruebaPrescritaSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string().trim().min(1).max(60),
  unidad: z.string().trim().min(1).max(12),
})
const DocumentoConfiguracionSeguimientoSchema = z
  .strictObject({
    /** El orden de la lista es el orden visible para el cliente. */
    indicadores: z.array(IndicadorSeguimientoSchema).max(6),
    registrosSolicitados: z.array(RegistroSolicitadoSchema).max(4),
    objetivoPeso: ObjetivoPesoSchema.nullable(),
    pruebasPrescritas: z.array(PruebaPrescritaSchema).max(20),
  })
  .refine((c) => new Set(c.indicadores).size === c.indicadores.length, "Indicador repetido")
  .refine(
    (c) =>
      new Set(c.registrosSolicitados.map((r) => r.indicador)).size ===
      c.registrosSolicitados.length,
    "Registro solicitado repetido",
  )
  .refine(
    (c) => new Set(c.pruebasPrescritas.map((p) => p.id)).size === c.pruebasPrescritas.length,
    "Prueba prescrita repetida",
  )

export const GuardarConfiguracionSeguimientoSchema =
  DocumentoConfiguracionSeguimientoSchema.safeExtend({
    revision: RevisionSchema,
  })
export type GuardarConfiguracionSeguimiento = z.infer<typeof GuardarConfiguracionSeguimientoSchema>
export const ConfiguracionSeguimientoSchema = GuardarConfiguracionSeguimientoSchema
export type ConfiguracionSeguimiento = z.infer<typeof ConfiguracionSeguimientoSchema>

export const CONFIGURACION_SEGUIMIENTO_INICIAL: ConfiguracionSeguimiento = {
  revision: 0,
  indicadores: ["peso", "pasos", "sueno", "cintura", "fuerza", "pruebas"],
  registrosSolicitados: [
    { indicador: "peso", frecuencia: "diaria", diaSemana: null },
    { indicador: "pasos", frecuencia: "diaria", diaSemana: null },
    { indicador: "sueno", frecuencia: "diaria", diaSemana: null },
  ],
  objetivoPeso: null,
  pruebasPrescritas: [],
}

export const DiaDeSeguimientoSchema = z.strictObject({
  fecha: FechaAgendaSchema,
  pesoKg: PesoCorporalSchema.nullable(),
  pasos: PasosSchema.nullable(),
  suenoMin: SuenoSchema.nullable(),
  creatina: z.boolean().nullable(),
  /** Otros suplementos de la dieta tomados ese día, por nombre. */
  suplementos: z.array(z.string()),
})
export type DiaDeSeguimiento = z.infer<typeof DiaDeSeguimientoSchema>

/** Lo que cambia el cliente en un día: solo los campos que envía; `null` borra. */
export const CambiarDiaSchema = z
  .strictObject({
    pesoKg: PesoCorporalSchema.nullable().optional(),
    pasos: PasosSchema.nullable().optional(),
    suenoMin: SuenoSchema.nullable().optional(),
    creatina: z.boolean().nullable().optional(),
    suplementos: z
      .array(z.string().trim().min(1).max(60))
      .max(10)
      .refine((nombres) => new Set(nombres).size === nombres.length, "Hay suplementos repetidos")
      .optional(),
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

export const RegistrarPruebaSchema = z.union([
  z.strictObject({
    operacionId: z.uuid(),
    fecha: FechaAgendaSchema,
    pruebaId: z.uuid(),
    valor: z.number().min(0).max(100_000),
  }),
  z.strictObject({
    operacionId: z.uuid(),
    fecha: FechaAgendaSchema,
    /** Forma heredada; el cliente registra pruebas nuevas con `pruebaId`. */
    nombre: z.string().trim().min(1).max(60),
    valor: z.number().min(0).max(100_000),
    unidad: z.string().trim().min(1).max(12),
  }),
])
export type RegistrarPrueba = z.infer<typeof RegistrarPruebaSchema>

export const PruebaFisicaSchema = z.strictObject({
  id: z.uuid(),
  pruebaId: z.uuid().nullable().optional(),
  fecha: FechaAgendaSchema,
  nombre: z.string(),
  valor: z.number(),
  unidad: z.string(),
  creadoEn: z.iso.datetime(),
})
export type PruebaFisica = z.infer<typeof PruebaFisicaSchema>

export const ListadoPruebasSchema = z.strictObject({ pruebas: z.array(PruebaFisicaSchema) })
export type ListadoPruebas = z.infer<typeof ListadoPruebasSchema>

/**
 * Histórico paginado de medidas y pruebas, del más reciente al más antiguo.
 * El cursor es opaco: se devuelve tal cual para pedir la página siguiente.
 * Los listados anteriores conservan su contrato.
 */
export const ConsultarPaginaSeguimientoSchema = z.strictObject({
  cursor: z.string().min(1).max(1000).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(500),
})
export type ConsultarPaginaSeguimiento = z.infer<typeof ConsultarPaginaSeguimientoSchema>

export const PaginaMedidasSchema = z.strictObject({
  medidas: z.array(MedidaSchema),
  fechaNacimiento: FechaAgendaSchema.nullable(),
  /** `null` cuando no quedan medidas más antiguas. */
  siguienteCursor: z.string().nullable(),
})
export type PaginaMedidas = z.infer<typeof PaginaMedidasSchema>

export const PaginaPruebasSchema = z.strictObject({
  pruebas: z.array(PruebaFisicaSchema),
  /** `null` cuando no quedan pruebas más antiguas. */
  siguienteCursor: z.string().nullable(),
})
export type PaginaPruebas = z.infer<typeof PaginaPruebasSchema>

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
