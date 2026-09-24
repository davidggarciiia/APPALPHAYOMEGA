import { z } from "zod"
import { RevisionSchema, SemanaSchema, SesionProgramadaSchema } from "./agenda"

const NombreSchema = z.string().trim().min(1).max(120)
const NotasSchema = z.string().trim().max(2000).nullable()
const PesoSchema = z.number().nonnegative().max(1000).nullable()
const RepeticionesSchema = z.number().int().min(1).max(10000)
const SegundosSchema = z.number().int().min(1).max(86400)

// Cada variante excluye la unidad de la otra, también al validar JSON externo.
// https://zod.dev/api#discriminated-unions
export const SeriePrescritaSchema = z.discriminatedUnion("tipoMedicion", [
  z.strictObject({
    id: z.uuid(),
    tipoMedicion: z.literal("repeticiones"),
    pesoKg: PesoSchema,
    repeticiones: RepeticionesSchema,
    /** Tope del rango («8–10»): la doble progresión sube carga al alcanzarlo. */
    repeticionesMax: RepeticionesSchema.optional(),
  }),
  z.strictObject({
    id: z.uuid(),
    tipoMedicion: z.literal("tiempo"),
    pesoKg: PesoSchema,
    segundos: SegundosSchema,
  }),
])
export type SeriePrescrita = z.infer<typeof SeriePrescritaSchema>

/** Partes de una sesión, en el orden en que se hacen (Design.html). */
export const SECCIONES_DE_SESION = ["calentamiento", "principal", "circuito", "final"] as const
export const SeccionDeSesionSchema = z.enum(SECCIONES_DE_SESION)
export type SeccionDeSesion = z.infer<typeof SeccionDeSesionSchema>
const RirSchema = z.number().int().min(0).max(5)
const TextoCorto = (max: number) => z.string().trim().min(1).max(max)

/**
 * Lo que el diseño añade a cada ejercicio de la sesión. Todo es opcional: una
 * prescripción anterior sigue siendo válida y se lee como parte principal.
 */
const CamposPrescripcionAmpliada = {
  seccion: SeccionDeSesionSchema.optional(),
  /** RIR objetivo: «RIR 3» es { min: 3, max: 3 }; «RIR 2–3», { min: 2, max: 3 }. */
  rir: z.strictObject({ min: RirSchema, max: RirSchema }).optional(),
  descanso: TextoCorto(30).optional(),
  /** Cómo se hace en calentamiento o final: «1×8 por lado», «3–4 min». */
  dosis: TextoCorto(60).optional(),
  /** Sin carga fijada: el cliente la busca las primeras sesiones. */
  calibrar: z.boolean().optional(),
  /** Cuánto sube la carga cuando toca: 2,5 kg, 1,25 kg… */
  subidaKg: z.number().positive().max(50).optional(),
  nota: TextoCorto(300).optional(),
  alternativas: z.array(TextoCorto(80)).max(5).optional(),
  /** Los compuestos nunca se recortan al bajar volumen. */
  compuesto: z.boolean().optional(),
}

const CamposEjercicioEnRutina = {
  id: z.uuid(),
  ejercicioId: z.uuid(),
  indicaciones: NotasSchema,
  series: z.array(SeriePrescritaSchema).min(1).max(30),
  ...CamposPrescripcionAmpliada,
}

/** Datos de la sesión entera que enseña el diseño. Opcionales por la misma razón. */
const CamposSesionAmpliada = {
  /** «100–115 min». */
  duracion: TextoCorto(30).optional(),
  /** Nota del entrenador para esta sesión: «Banca: 60 kg de inicio para 4×6». */
  nota: TextoCorto(300).optional(),
  /** Minutos de cada parte, como texto: «8–10». */
  partes: z
    .strictObject({
      calentamiento: TextoCorto(20).optional(),
      fuerza: TextoCorto(20).optional(),
      cardio: TextoCorto(20).optional(),
      calma: TextoCorto(20).optional(),
    })
    .optional(),
  circuito: z
    .strictObject({
      vueltas: z.number().int().min(1).max(10),
      descanso: TextoCorto(30).optional(),
    })
    .optional(),
}

function rangosValidos(sesion: {
  ejercicios: Array<{ rir?: { min: number; max: number }; series: SeriePrescrita[] }>
}): boolean {
  return sesion.ejercicios.every(
    (ejercicio) =>
      (ejercicio.rir === undefined || ejercicio.rir.min <= ejercicio.rir.max) &&
      ejercicio.series.every(
        (serie) =>
          serie.tipoMedicion !== "repeticiones" ||
          serie.repeticionesMax === undefined ||
          serie.repeticionesMax >= serie.repeticiones,
      ),
  )
}
export const EjercicioEnRutinaSchema = z.strictObject(CamposEjercicioEnRutina)
export type EjercicioEnRutina = z.infer<typeof EjercicioEnRutinaSchema>
export const EjercicioPrescritoSchema = z.strictObject({
  ...CamposEjercicioEnRutina,
  nombre: NombreSchema,
})
export type EjercicioPrescrito = z.infer<typeof EjercicioPrescritoSchema>

function idsDeSesionUnicos(sesion: { ejercicios: EjercicioEnRutina[] }): boolean {
  const ejercicios = sesion.ejercicios.map((ejercicio) => ejercicio.id)
  const series = sesion.ejercicios.flatMap((ejercicio) => ejercicio.series.map((serie) => serie.id))
  return new Set(ejercicios).size === ejercicios.length && new Set(series).size === series.length
}

export const PrescripcionSchema = z
  .strictObject({
    nombre: NombreSchema,
    ejercicios: z.array(EjercicioPrescritoSchema).min(1).max(40),
    ...CamposSesionAmpliada,
  })
  .refine(
    idsDeSesionUnicos,
    "Los identificadores de ejercicios y series deben ser únicos dentro de la sesión",
  )
  .refine(rangosValidos, "Un rango no puede acabar antes de empezar")
export type Prescripcion = z.infer<typeof PrescripcionSchema>

export const SesionEnRutinaSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: NombreSchema,
    diaSemana: z.number().int().min(1).max(7),
    ejercicios: z.array(EjercicioEnRutinaSchema).min(1).max(40),
    ...CamposSesionAmpliada,
  })
  .refine(idsDeSesionUnicos, "Hay identificadores repetidos en la sesión")
  .refine(rangosValidos, "Un rango no puede acabar antes de empezar")
export type SesionEnRutina = z.infer<typeof SesionEnRutinaSchema>

export const PatronRutinaSchema = z
  .strictObject({
    sesiones: z.array(SesionEnRutinaSchema).min(1).max(14),
  })
  .refine(
    (patron) => new Set(patron.sesiones.map((sesion) => sesion.id)).size === patron.sesiones.length,
    "Hay sesiones repetidas",
  )
export type PatronRutina = z.infer<typeof PatronRutinaSchema>

export const MAX_SERIES_PLAN = 10000
export const AsignarPlanSchema = z
  .strictObject({
    operacionId: z.uuid(),
    nombre: NombreSchema,
    semanaInicial: SemanaSchema,
    semanas: z.number().int().min(1).max(52),
    patron: PatronRutinaSchema,
  })
  .refine(
    (datos) =>
      datos.semanas *
        datos.patron.sesiones.reduce(
          (total, sesion) =>
            total +
            sesion.ejercicios.reduce((suma, ejercicio) => suma + ejercicio.series.length, 0),
          0,
        ) <=
      MAX_SERIES_PLAN,
    "Divide este plan: admite como máximo 10.000 series entre todas las semanas",
  )
export type AsignarPlan = z.infer<typeof AsignarPlanSchema>

export const GuardarRutinaSchema = z.strictObject({
  nombre: NombreSchema,
  patron: PatronRutinaSchema,
})
export type GuardarRutina = z.infer<typeof GuardarRutinaSchema>
export const EditarRutinaSchema = GuardarRutinaSchema.extend({ revision: RevisionSchema })
export type EditarRutina = z.infer<typeof EditarRutinaSchema>
export const RutinaGuardadaSchema = GuardarRutinaSchema.extend({
  id: z.uuid(),
  revision: RevisionSchema,
})
export type RutinaGuardada = z.infer<typeof RutinaGuardadaSchema>
export const ListadoRutinasSchema = z.strictObject({
  rutinas: z.array(RutinaGuardadaSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoRutinas = z.infer<typeof ListadoRutinasSchema>
export const ConsultarRutinasSchema = z.strictObject({
  buscar: z.string().trim().max(120).default(""),
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarRutinas = z.infer<typeof ConsultarRutinasSchema>

export const CambiarPrescripcionSchema = z
  .strictObject({
    revisionPrescripcion: RevisionSchema,
    nombre: NombreSchema,
    ejercicios: z.array(EjercicioEnRutinaSchema).min(1).max(40),
    ...CamposSesionAmpliada,
  })
  .refine(idsDeSesionUnicos, "Hay identificadores repetidos en la sesión")
  .refine(rangosValidos, "Un rango no puede acabar antes de empezar")
export type CambiarPrescripcion = z.infer<typeof CambiarPrescripcionSchema>

const CamposRegistroSerie = {
  serieId: z.uuid(),
  pesoKg: PesoSchema,
  hecha: z.boolean(),
  /** «¿Cuántas te quedaban?»: 0 a 5, donde 5 es «5 o más». */
  rir: RirSchema.nullable().optional(),
}
export const SerieRegistradaSchema = z
  .discriminatedUnion("tipoMedicion", [
    z.strictObject({
      ...CamposRegistroSerie,
      tipoMedicion: z.literal("repeticiones"),
      repeticiones: RepeticionesSchema.nullable(),
    }),
    z.strictObject({
      ...CamposRegistroSerie,
      tipoMedicion: z.literal("tiempo"),
      segundos: SegundosSchema.nullable(),
    }),
  ])
  .refine(
    (serie) =>
      !serie.hecha ||
      (serie.tipoMedicion === "repeticiones"
        ? serie.repeticiones !== null
        : serie.segundos !== null),
    "Una serie hecha necesita repeticiones o segundos registrados",
  )
export type SerieRegistrada = z.infer<typeof SerieRegistradaSchema>

/** Antes de empezar: cómo llega el cliente. */
export const CheckinSchema = z.strictObject({
  sensacion: z.number().int().min(1).max(5),
  molestia: z.enum(["nada", "agujetas", "dolor"]),
})
export type Checkin = z.infer<typeof CheckinSchema>

/** Al terminar: esfuerzo global, cómo acaba y si algo fue incómodo. */
export const CierreSchema = z.strictObject({
  esfuerzo: z.number().int().min(0).max(10),
  energia: z.number().int().min(1).max(5),
  incomodo: z.boolean(),
})
export type Cierre = z.infer<typeof CierreSchema>

const CamposSesionVivida = {
  checkin: CheckinSchema.nullable().optional(),
  cierre: CierreSchema.nullable().optional(),
  /** Cuándo empezó: el cronómetro y la duración salen de aquí. */
  inicio: z.iso.datetime().nullable().optional(),
}

export const RegistroSchema = z
  .strictObject({
    series: z.array(SerieRegistradaSchema).max(1200),
    notas: NotasSchema,
    ...CamposSesionVivida,
  })
  .refine(
    (registro) =>
      new Set(registro.series.map((serie) => serie.serieId)).size === registro.series.length,
    "Una serie solo puede registrarse una vez",
  )
export type Registro = z.infer<typeof RegistroSchema>

/** Usar la prescripción leída por el servidor tras comprobar propietario y revisión. */
export function crearRegistroDeSesionSchema(prescripcion: Prescripcion): z.ZodType<Registro> {
  const prescritas = new Map(
    prescripcion.ejercicios.flatMap((ejercicio) =>
      ejercicio.series.map((serie) => [serie.id, serie] as const),
    ),
  )
  return RegistroSchema.refine(
    (registro) =>
      registro.series.every((serie) => {
        const objetivo = prescritas.get(serie.serieId)
        return (
          objetivo !== undefined &&
          objetivo.tipoMedicion === serie.tipoMedicion &&
          (!serie.hecha || objetivo.pesoKg === null || serie.pesoKg !== null)
        )
      }),
    "Las series deben pertenecer a la sesión, mantener su unidad y registrar la carga requerida",
  )
}

export const GuardarBorradorSchema = z.strictObject({
  operacionId: z.uuid(),
  revisionPrescripcion: RevisionSchema,
  revisionBorrador: RevisionSchema,
  registro: RegistroSchema,
})
export type GuardarBorrador = z.infer<typeof GuardarBorradorSchema>
export const EnviarEntrenamientoSchema = GuardarBorradorSchema.refine(
  (envio) => envio.registro.series.some((serie) => serie.hecha),
  "Completa al menos una serie antes de enviar",
)
export type EnviarEntrenamiento = z.infer<typeof EnviarEntrenamientoSchema>

export const BorradorSchema = z.strictObject({
  revision: RevisionSchema,
  revisionPrescripcion: RevisionSchema,
  registro: RegistroSchema,
  actualizadoEn: z.iso.datetime(),
})
export type Borrador = z.infer<typeof BorradorSchema>

const CamposSesionPublica = {
  agenda: SesionProgramadaSchema,
  prescripcion: PrescripcionSchema,
  revisionPrescripcion: RevisionSchema,
  permiteAjuste: z.boolean(),
  enviadoEn: z.iso.datetime().nullable(),
}
export const SesionEntrenadorSchema = z.strictObject(CamposSesionPublica)
export type SesionEntrenador = z.infer<typeof SesionEntrenadorSchema>
export const SesionClienteSchema = z.strictObject({
  ...CamposSesionPublica,
  borrador: BorradorSchema.nullable(),
})
export type SesionCliente = z.infer<typeof SesionClienteSchema>

export const ResumenSesionSchema = z.strictObject({
  agenda: SesionProgramadaSchema,
  nombre: NombreSchema,
  enviadoEn: z.iso.datetime().nullable(),
})
export type ResumenSesion = z.infer<typeof ResumenSesionSchema>
export const ListadoSesionesSchema = z.strictObject({
  sesiones: z.array(ResumenSesionSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoSesiones = z.infer<typeof ListadoSesionesSchema>
export const PlanAsignadoSchema = z.strictObject({
  id: z.uuid(),
  operacionId: z.uuid(),
  sesiones: z.array(ResumenSesionSchema).min(1),
})
export type PlanAsignado = z.infer<typeof PlanAsignadoSchema>

export const ValoresEjecutadosSchema = z.discriminatedUnion("tipoMedicion", [
  z.strictObject({
    tipoMedicion: z.literal("repeticiones"),
    pesoKg: PesoSchema,
    repeticiones: RepeticionesSchema,
    rir: RirSchema.nullable().optional(),
  }),
  z.strictObject({
    tipoMedicion: z.literal("tiempo"),
    pesoKg: PesoSchema,
    segundos: SegundosSchema,
    rir: RirSchema.nullable().optional(),
  }),
])
export type ValoresEjecutados = z.infer<typeof ValoresEjecutadosSchema>
export const ResultadoSerieSchema = z.discriminatedUnion("hecha", [
  z.strictObject({ serieId: z.uuid(), hecha: z.literal(false) }),
  z.strictObject({ serieId: z.uuid(), hecha: z.literal(true), valores: ValoresEjecutadosSchema }),
])
export type ResultadoSerie = z.infer<typeof ResultadoSerieSchema>

export const ResultadoEntrenamientoSchema = z
  .strictObject({
    sesionId: z.uuid(),
    prescripcion: PrescripcionSchema,
    revisionPrescripcion: RevisionSchema,
    enviadoEn: z.iso.datetime(),
    notas: NotasSchema,
    series: z.array(ResultadoSerieSchema).min(1).max(1200),
    ...CamposSesionVivida,
  })
  .refine((resultado) => {
    const prescritas = new Map(
      resultado.prescripcion.ejercicios.flatMap((ejercicio) =>
        ejercicio.series.map((serie) => [serie.id, serie] as const),
      ),
    )
    return (
      resultado.series.length === prescritas.size &&
      new Set(resultado.series.map((serie) => serie.serieId)).size === prescritas.size &&
      resultado.series.some((serie) => serie.hecha) &&
      resultado.series.every((serie) => {
        const objetivo = prescritas.get(serie.serieId)
        return (
          objetivo !== undefined &&
          (!serie.hecha ||
            (objetivo.tipoMedicion === serie.valores.tipoMedicion &&
              (objetivo.pesoKg === null || serie.valores.pesoKg !== null)))
        )
      })
    )
  }, "El resultado debe representar cada serie prescrita, con ejecución válida u omisión explícita")
export type ResultadoEntrenamiento = z.infer<typeof ResultadoEntrenamientoSchema>

/** «Anterior 65 kg × 6»: la mejor serie hecha la última vez de cada ejercicio. */
export const AnteriorSchema = z.strictObject({
  ejercicioId: z.uuid(),
  fecha: z.iso.datetime(),
  valores: ValoresEjecutadosSchema,
})
export type Anterior = z.infer<typeof AnteriorSchema>
export const ListadoAnterioresSchema = z.strictObject({
  anteriores: z.array(AnteriorSchema).max(40),
})
export type ListadoAnteriores = z.infer<typeof ListadoAnterioresSchema>
