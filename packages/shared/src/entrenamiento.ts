import { z } from "zod"
import { RevisionSchema, SemanaSchema, SesionProgramadaSchema } from "./agenda"

const NombreSchema = z.string().trim().min(1).max(120)
const NotasSchema = z.string().trim().max(2000).nullable()
const PesoSchema = z.number().nonnegative().max(1000).nullable()
const RepeticionesSchema = z.number().int().min(1).max(10000)
const SegundosSchema = z.number().int().min(1).max(86400)
/** Metros enteros, como repeticiones y segundos; el tope solo frena datos absurdos. */
const MetrosSchema = z.number().int().min(1).max(100000)

/**
 * D01 · Serie por distancia, con kilos si el ejercicio los lleva (un transporte).
 * Forma parte de SeriePrescritaSchema desde D01.g; se exporta aparte para validarla sola.
 */
export const SeriePrescritaDistanciaSchema = z.strictObject({
  id: z.uuid(),
  tipoMedicion: z.literal("distancia"),
  pesoKg: PesoSchema,
  metros: MetrosSchema,
})
export type SeriePrescritaDistancia = z.infer<typeof SeriePrescritaDistanciaSchema>

// Cada variante excluye la unidad de las otras, también al validar JSON externo.
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
  SeriePrescritaDistanciaSchema,
])
export type SeriePrescrita = z.infer<typeof SeriePrescritaSchema>

/** Partes de una sesión, en el orden en que se hacen (Design.html). */
export const SECCIONES_DE_SESION = ["calentamiento", "principal", "circuito", "final"] as const
export const SeccionDeSesionSchema = z.enum(SECCIONES_DE_SESION)
export type SeccionDeSesion = z.infer<typeof SeccionDeSesionSchema>
const RirSchema = z.number().int().min(0).max(5)
const TextoCorto = (max: number) => z.string().trim().min(1).max(max)
const RangoRirSchema = z
  .strictObject({ min: RirSchema, max: RirSchema })
  .refine((rir) => rir.min <= rir.max, "Un rango no puede acabar antes de empezar")

export const AjustesDeFaseSchema = z.strictObject({
  rirCompuestos: RangoRirSchema.optional(),
  rirAccesorios: RangoRirSchema.optional(),
  factorSeries: z.number().min(0.3).max(1).optional(),
  factorCarga: z.number().min(0.5).max(1.1).optional(),
})
export type AjustesDeFase = z.infer<typeof AjustesDeFaseSchema>

/**
 * Lo que el diseño añade a cada ejercicio de la sesión. Todo es opcional: una
 * prescripción anterior sigue siendo válida y se lee como parte principal.
 */
const CamposPrescripcionAmpliada = {
  seccion: SeccionDeSesionSchema.optional(),
  /** RIR objetivo: «RIR 3» es { min: 3, max: 3 }; «RIR 2–3», { min: 2, max: 3 }. */
  rir: z.strictObject({ min: RirSchema, max: RirSchema }).optional(),
  /** Cuándo se ofrece el RIR al cliente; nunca se exige respuesta. */
  modoRir: z.enum(["desactivado", "alFinalizarEjercicio", "cadaSerie"]).optional(),
  /** Ausente en prescripciones antiguas, que conservan su comportamiento anterior. */
  tipoCarga: z.enum(["conCargaExterna", "sinCarga"]).optional(),
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
      /** «Core»: cómo llama el entrenador al circuito. */
      nombre: TextoCorto(30).optional(),
      vueltas: z.number().int().min(1).max(10),
      descanso: TextoCorto(30).optional(),
    })
    .optional(),
}

function rangosValidos(sesion: {
  ejercicios: Array<{
    rir?: { min: number; max: number }
    series: SeriePrescrita[]
  }>
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

function cargasValidas(sesion: {
  ejercicios: Array<{
    tipoCarga?: "conCargaExterna" | "sinCarga"
    calibrar?: boolean
    subidaKg?: number
    series: SeriePrescrita[]
  }>
}): boolean {
  return sesion.ejercicios.every(
    (ejercicio) =>
      ejercicio.tipoCarga !== "sinCarga" ||
      (!ejercicio.calibrar &&
        ejercicio.subidaKg === undefined &&
        ejercicio.series.every((serie) => serie.pesoKg === null)),
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
    /** Copia de la fase al asignar; no depende de la fecha actual de la sesión. */
    fase: z.strictObject({ nombre: TextoCorto(40), ajustes: AjustesDeFaseSchema }).optional(),
  })
  .refine(
    idsDeSesionUnicos,
    "Los identificadores de ejercicios y series deben ser únicos dentro de la sesión",
  )
  .refine(rangosValidos, "Un rango no puede acabar antes de empezar")
  .refine(cargasValidas, "Un ejercicio sin carga externa no admite kilos ni calibración")
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
  .refine(cargasValidas, "Un ejercicio sin carga externa no admite kilos ni calibración")
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

/** Una fase del bloque: «Semanas 1–2 · Calibrar · RIR 3 · accesorios 2–3». */
export const FaseDeBloqueSchema = z
  .strictObject({
    desde: z.number().int().min(1).max(52),
    hasta: z.number().int().min(1).max(52),
    nombre: TextoCorto(40),
    detalle: TextoCorto(120).nullable(),
    ajustes: AjustesDeFaseSchema.optional(),
  })
  .refine((fase) => fase.desde <= fase.hasta, "Una fase no puede acabar antes de empezar")
export type FaseDeBloque = z.infer<typeof FaseDeBloqueSchema>

/** Una fase solo de texto no tapa otra que sí cambia la prescripción. */
export function faseDeSemana(fases: FaseDeBloque[], semana: number): FaseDeBloque | undefined {
  const coinciden = fases.filter((fase) => fase.desde <= semana && semana <= fase.hasta)
  return coinciden.find((fase) => fase.ajustes) ?? coinciden[0]
}

/** Mantiene el paso del ejercicio y el límite de carga del contrato. */
export function redondearCarga(pesoKg: number, subidaKg = 0.5): number {
  const pasos = Math.min(Math.round(pesoKg / subidaKg), Math.floor(1000 / subidaKg))
  return Number((pasos * subidaKg).toFixed(6))
}

/** La misma prescripción en API y vista previa; nunca modifica el patrón base. */
export function aplicarAjustesDeFase<T extends { ejercicios: EjercicioEnRutina[] }>(
  prescripcion: T,
  ajustes?: AjustesDeFase,
): T {
  if (!ajustes) return prescripcion
  return {
    ...prescripcion,
    ejercicios: prescripcion.ejercicios.map((ejercicio) => {
      const rir = ejercicio.compuesto ? ajustes.rirCompuestos : ajustes.rirAccesorios
      const cantidad = ejercicio.compuesto
        ? ejercicio.series.length
        : Math.max(1, Math.round(ejercicio.series.length * (ajustes.factorSeries ?? 1)))
      return {
        ...ejercicio,
        ...(rir && { rir: { ...rir } }),
        series: ejercicio.series.slice(0, cantidad).map((serie) => ({
          ...serie,
          pesoKg:
            serie.pesoKg === null || ajustes.factorCarga === undefined
              ? serie.pesoKg
              : redondearCarga(serie.pesoKg * ajustes.factorCarga, ejercicio.subidaKg),
        })),
      }
    }),
  }
}

/** Otro deporte que convive con el plan: «K-1: jueves y domingo, 60 min». */
export const DeporteDelPlanSchema = z.strictObject({
  nombre: TextoCorto(40),
  dias: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((dias) => new Set(dias).size === dias.length, "Hay días repetidos"),
  minutos: z.number().int().min(1).max(600).nullable(),
})
export type DeporteDelPlan = z.infer<typeof DeporteDelPlanSchema>

/** Lo que el cliente ve en «Bloque»: qué buscamos, fases, otros deportes y notas. */
export const BloqueSchema = z.strictObject({
  objetivos: z.array(TextoCorto(120)).max(6),
  fases: z.array(FaseDeBloqueSchema).max(8),
  deportes: z.array(DeporteDelPlanSchema).max(4),
  notas: z.array(TextoCorto(200)).max(10),
  /** Objetivo de pasos al día: «3.240 / 7.000». */
  pasosDiarios: z.number().int().min(1000).max(40000).optional(),
})
export type Bloque = z.infer<typeof BloqueSchema>

const fasesDentro = (datos: { semanas: number; bloque?: Bloque | null }): boolean =>
  (datos.bloque?.fases ?? []).every((fase) => fase.hasta <= datos.semanas)

export const MAX_SERIES_PLAN = 10000
export const AsignarPlanSchema = z
  .strictObject({
    operacionId: z.uuid(),
    nombre: NombreSchema,
    semanaInicial: SemanaSchema,
    semanas: z.number().int().min(1).max(52),
    patron: PatronRutinaSchema,
    bloque: BloqueSchema.optional(),
  })
  .refine(fasesDentro, "Las fases deben caber en las semanas del plan")
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

export const PlanVigenteSchema = z.strictObject({
  id: z.uuid(),
  nombre: NombreSchema,
  semanaInicial: SemanaSchema,
  semanas: z.number().int().min(1).max(52),
  version: z.number().int().positive(),
  bloque: BloqueSchema.nullable(),
})
export type PlanVigente = z.infer<typeof PlanVigenteSchema>
export const PlanVigenteRespuestaSchema = z.strictObject({ plan: PlanVigenteSchema.nullable() })
export type PlanVigenteRespuesta = z.infer<typeof PlanVigenteRespuestaSchema>

export const CambiarBloqueSchema = z.strictObject({
  version: z.number().int().positive(),
  bloque: BloqueSchema,
})
export type CambiarBloque = z.infer<typeof CambiarBloqueSchema>

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
  .refine(cargasValidas, "Un ejercicio sin carga externa no admite kilos ni calibración")
export type CambiarPrescripcion = z.infer<typeof CambiarPrescripcionSchema>

const CamposRegistroSerie = {
  serieId: z.uuid(),
  pesoKg: PesoSchema,
  hecha: z.boolean(),
  /** Ausente y hecha=false significa pendiente en registros históricos. */
  omitida: z.literal(true).optional(),
  /** «¿Cuántas te quedaban?»: 0 a 5, donde 5 es «5 o más». */
  rir: RirSchema.nullable().optional(),
}

const SerieRegistradaRepeticiones = z.strictObject({
  ...CamposRegistroSerie,
  tipoMedicion: z.literal("repeticiones"),
  repeticiones: RepeticionesSchema.nullable(),
})
const SerieRegistradaTiempo = z.strictObject({
  ...CamposRegistroSerie,
  tipoMedicion: z.literal("tiempo"),
  segundos: SegundosSchema.nullable(),
})
// D01: variante sin refinar; desde D01.g forma parte de SerieRegistradaSchema.
const SerieRegistradaDistanciaBase = z.strictObject({
  ...CamposRegistroSerie,
  tipoMedicion: z.literal("distancia"),
  metros: MetrosSchema.nullable(),
})
type SerieRegistradaEnUnidad = z.infer<
  | typeof SerieRegistradaRepeticiones
  | typeof SerieRegistradaTiempo
  | typeof SerieRegistradaDistanciaBase
>

/** Lo medido en la unidad de la serie; null mientras el cliente no lo escribe. */
function cantidadRegistrada(serie: SerieRegistradaEnUnidad): number | null {
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return serie.repeticiones
    case "tiempo":
      return serie.segundos
    case "distancia":
      return serie.metros
  }
}
const hechaConCantidad = (serie: SerieRegistradaEnUnidad): boolean =>
  !serie.hecha || cantidadRegistrada(serie) !== null
const hechaSinOmitir = (serie: SerieRegistradaEnUnidad): boolean =>
  !serie.hecha || serie.omitida !== true

export const SerieRegistradaSchema = z
  .discriminatedUnion("tipoMedicion", [
    SerieRegistradaRepeticiones,
    SerieRegistradaTiempo,
    SerieRegistradaDistanciaBase,
  ])
  .refine(hechaConCantidad, "Una serie hecha necesita la cantidad registrada en su unidad")
  .refine(hechaSinOmitir, "Una serie hecha no puede estar omitida")
export type SerieRegistrada = z.infer<typeof SerieRegistradaSchema>

/** D01 · Resultado por distancia, separado del objetivo; se exporta aparte para validarlo solo. */
export const SerieRegistradaDistanciaSchema = SerieRegistradaDistanciaBase.refine(
  hechaConCantidad,
  "Una serie hecha necesita los metros registrados",
).refine(hechaSinOmitir, "Una serie hecha no puede estar omitida")
export type SerieRegistradaDistancia = z.infer<typeof SerieRegistradaDistanciaBase>

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
  /** Tiempo real de actividad; ausente en registros previos al cronómetro con pausas. */
  tiempoActivoSegundos: z.number().int().nonnegative().optional(),
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

function cargaEjecutadaValida(
  hecha: boolean,
  pesoKg: number | null,
  objetivo: { pesoKg: number | null },
  tipoCarga: "conCargaExterna" | "sinCarga" | undefined,
): boolean {
  if (!hecha) return true
  if (tipoCarga === "sinCarga") return pesoKg === null
  if (tipoCarga === "conCargaExterna") return pesoKg !== null
  return objetivo.pesoKg === null || pesoKg !== null
}

/** Lo registrado conserva la unidad pautada y la carga que pide el ejercicio. */
export function mantieneUnidadYCarga(
  serie: Pick<SerieRegistrada, "tipoMedicion" | "hecha" | "pesoKg">,
  objetivo: Pick<SeriePrescrita, "tipoMedicion" | "pesoKg">,
  tipoCarga: "conCargaExterna" | "sinCarga" | undefined,
): boolean {
  return (
    serie.tipoMedicion === objetivo.tipoMedicion &&
    cargaEjecutadaValida(serie.hecha, serie.pesoKg, objetivo, tipoCarga)
  )
}

/** Usar la prescripción leída por el servidor tras comprobar propietario y revisión. */
export function crearRegistroDeSesionSchema(prescripcion: Prescripcion): z.ZodType<Registro> {
  const prescritas = new Map(
    prescripcion.ejercicios.flatMap((ejercicio) =>
      ejercicio.series.map(
        (serie) => [serie.id, { serie, tipoCarga: ejercicio.tipoCarga }] as const,
      ),
    ),
  )
  return RegistroSchema.refine(
    (registro) =>
      registro.series.every((serie) => {
        const prescrita = prescritas.get(serie.serieId)
        return (
          prescrita !== undefined &&
          mantieneUnidadYCarga(serie, prescrita.serie, prescrita.tipoCarga)
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
  /** Se marca únicamente mediante la acción explícita del entrenador. */
  revisadaEn: z.iso.datetime().nullable().optional(),
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

/** D01 · Lo hecho en una serie por distancia; forma parte de la unión de abajo desde D01.g. */
export const ValoresEjecutadosDistanciaSchema = z.strictObject({
  tipoMedicion: z.literal("distancia"),
  pesoKg: PesoSchema,
  metros: MetrosSchema,
  rir: RirSchema.nullable().optional(),
})
export type ValoresEjecutadosDistancia = z.infer<typeof ValoresEjecutadosDistanciaSchema>
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
  ValoresEjecutadosDistanciaSchema,
])
export type ValoresEjecutados = z.infer<typeof ValoresEjecutadosSchema>
export const ResultadoSerieSchema = z.discriminatedUnion("hecha", [
  z.strictObject({
    serieId: z.uuid(),
    hecha: z.literal(false),
    omitida: z.literal(true).optional(),
  }),
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
        ejercicio.series.map(
          (serie) => [serie.id, { serie, tipoCarga: ejercicio.tipoCarga }] as const,
        ),
      ),
    )
    return (
      resultado.series.length === prescritas.size &&
      new Set(resultado.series.map((serie) => serie.serieId)).size === prescritas.size &&
      resultado.series.some((serie) => serie.hecha) &&
      resultado.series.every((serie) => {
        const prescrita = prescritas.get(serie.serieId)
        return (
          prescrita !== undefined &&
          (!serie.hecha ||
            mantieneUnidadYCarga(
              { ...serie.valores, hecha: true },
              prescrita.serie,
              prescrita.tipoCarga,
            ))
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

/** Las últimas sesiones enviadas de un cliente, con su resultado, para su ficha. */
export const ConsultarResultadosSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(60).default(20),
})
export type ConsultarResultados = z.infer<typeof ConsultarResultadosSchema>
export const ListadoResultadosSchema = z.strictObject({
  resultados: z.array(
    z.strictObject({ agenda: SesionProgramadaSchema, resultado: ResultadoEntrenamientoSchema }),
  ),
})
export type ListadoResultados = z.infer<typeof ListadoResultadosSchema>

/** «Comentario sobre la sesión»: de la sesión entera o de un ejercicio. */
export const ComentarSesionSchema = z.strictObject({
  operacionId: z.uuid(),
  ejercicioPrescritoId: z.uuid().nullable(),
  texto: z.string().trim().min(1).max(2000),
})
export type ComentarSesion = z.infer<typeof ComentarSesionSchema>

export const ComentarioSesionSchema = z.strictObject({
  id: z.uuid(),
  sesionId: z.uuid(),
  ejercicioPrescritoId: z.uuid().nullable(),
  /** Nombre del ejercicio cuando se comentó, para «sobre el press banca». */
  ejercicio: z.string().nullable(),
  texto: z.string(),
  autor: z.strictObject({
    id: z.uuid(),
    nombre: z.string(),
    rol: z.enum(["cliente", "entrenador"]),
  }),
  creadoEn: z.iso.datetime(),
})
export type ComentarioSesion = z.infer<typeof ComentarioSesionSchema>
export const ListadoComentariosSchema = z.strictObject({
  comentarios: z.array(ComentarioSesionSchema),
})
export type ListadoComentarios = z.infer<typeof ListadoComentariosSchema>

export const TiposNovedadEntrenamientoSchema = z.enum([
  "entrenamiento_enviado",
  "sesion_revisada",
  "comentario",
  "molestia",
  "molestia_atendida",
  "fecha_cambiada",
])
export type TipoNovedadEntrenamiento = z.infer<typeof TiposNovedadEntrenamientoSchema>

export const NovedadEntrenamientoSchema = z.strictObject({
  id: z.uuid(),
  sesionId: z.uuid(),
  clienteId: z.uuid(),
  tipo: TiposNovedadEntrenamientoSchema,
  sesionNombre: NombreSchema,
  autor: z.strictObject({
    id: z.uuid(),
    nombre: NombreSchema,
    rol: z.enum(["cliente", "entrenador"]),
  }),
  creadaEn: z.iso.datetime(),
  leidaEn: z.iso.datetime().nullable(),
})
export type NovedadEntrenamiento = z.infer<typeof NovedadEntrenamientoSchema>

export const ConsultarNovedadesSchema = z.strictObject({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarNovedades = z.infer<typeof ConsultarNovedadesSchema>

export const ListadoNovedadesSchema = z.strictObject({
  novedades: z.array(NovedadEntrenamientoSchema),
  total: z.number().int().nonnegative(),
  sinLeer: z.number().int().nonnegative(),
})
export type ListadoNovedades = z.infer<typeof ListadoNovedadesSchema>

export const MarcarNovedadesLeidasSchema = z.strictObject({
  novedadIds: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Elige cada novedad una sola vez"),
})
export type MarcarNovedadesLeidas = z.infer<typeof MarcarNovedadesLeidasSchema>

export const NovedadesLeidasSchema = z.strictObject({ leidas: z.number().int().nonnegative() })
export type NovedadesLeidas = z.infer<typeof NovedadesLeidasSchema>
