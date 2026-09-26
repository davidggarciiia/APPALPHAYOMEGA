import { z } from "zod"
import { RevisionSchema, SemanaSchema, SesionProgramadaSchema, sumarDias } from "./agenda"

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
  }),
  z.strictObject({
    id: z.uuid(),
    tipoMedicion: z.literal("tiempo"),
    pesoKg: PesoSchema,
    segundos: SegundosSchema,
  }),
])
export type SeriePrescrita = z.infer<typeof SeriePrescritaSchema>

const CamposEjercicioEnRutina = {
  id: z.uuid(),
  ejercicioId: z.uuid(),
  indicaciones: NotasSchema,
  series: z.array(SeriePrescritaSchema).min(1).max(30),
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
  })
  .refine(
    idsDeSesionUnicos,
    "Los identificadores de ejercicios y series deben ser únicos dentro de la sesión",
  )
export type Prescripcion = z.infer<typeof PrescripcionSchema>

export const SesionEnRutinaSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: NombreSchema,
    diaSemana: z.number().int().min(1).max(7),
    ejercicios: z.array(EjercicioEnRutinaSchema).min(1).max(40),
  })
  .refine(idsDeSesionUnicos, "Hay identificadores repetidos en la sesión")
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

export const AsignarPlanSchema = z.strictObject({
  operacionId: z.uuid(),
  nombre: NombreSchema,
  semanaInicial: SemanaSchema,
  semanas: z.number().int().min(1).max(52),
  patron: PatronRutinaSchema,
})
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

export const CambiarPrescripcionSchema = z
  .strictObject({
    revisionPrescripcion: RevisionSchema,
    nombre: NombreSchema,
    ejercicios: z.array(EjercicioEnRutinaSchema).min(1).max(40),
  })
  .refine(idsDeSesionUnicos, "Hay identificadores repetidos en la sesión")
export type CambiarPrescripcion = z.infer<typeof CambiarPrescripcionSchema>

const CamposRegistroSerie = { serieId: z.uuid(), pesoKg: PesoSchema, hecha: z.boolean() }
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

export const RegistroSchema = z
  .strictObject({
    series: z.array(SerieRegistradaSchema).max(1200),
    notas: NotasSchema,
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
  }),
  z.strictObject({
    tipoMedicion: z.literal("tiempo"),
    pesoKg: PesoSchema,
    segundos: SegundosSchema,
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

/** Identificador de un recurso que viaja en la ruta. */
export const IdSchema = z.uuid()

/** Semana (su lunes) y cuántas semanas seguidas se quieren ver. */
export const ConsultarSesionesSchema = z.strictObject({
  semana: SemanaSchema,
  semanas: z.coerce.number().int().min(1).max(52).default(1),
})
export type ConsultarSesiones = z.infer<typeof ConsultarSesionesSchema>

/** El panel del entrenador: una semana, de todos o de un cliente. */
export const ConsultarPanelSchema = z.strictObject({
  semana: SemanaSchema,
  clienteId: z.uuid().optional(),
})
export type ConsultarPanel = z.infer<typeof ConsultarPanelSchema>

/**
 * Cuánto se hizo de lo previsto. Se deriva solo del resultado enviado: mientras
 * la sesión no se envía vale `null`, igual haya borrador o no.
 */
export const ResumenEjecucionSchema = z.strictObject({
  seriesHechas: z.number().int().nonnegative(),
  seriesPrescritas: z.number().int().positive(),
})
export type ResumenEjecucion = z.infer<typeof ResumenEjecucionSchema>

export const ClienteDelPanelSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string(),
  apellidos: z.string().nullable(),
})
export type ClienteDelPanel = z.infer<typeof ClienteDelPanelSchema>

export const FilaPanelSchema = z.strictObject({
  agenda: SesionProgramadaSchema,
  nombre: NombreSchema,
  enviadoEn: z.iso.datetime().nullable(),
  cliente: ClienteDelPanelSchema,
  ejecucion: ResumenEjecucionSchema.nullable(),
})
export type FilaPanel = z.infer<typeof FilaPanelSchema>

export const PanelSemanalSchema = z.strictObject({
  semana: SemanaSchema,
  sesiones: z.array(FilaPanelSchema),
})
export type PanelSemanal = z.infer<typeof PanelSemanalSchema>

export const ResumenPlanSchema = z.strictObject({
  id: z.uuid(),
  nombre: NombreSchema,
  semanaInicial: SemanaSchema,
  semanas: z.number().int().min(1).max(52),
  creadoEn: z.iso.datetime(),
  sesionesTotales: z.number().int().nonnegative(),
  /** Ni empezadas ni enviadas: las únicas que se pueden anular o ajustar. */
  sesionesSinIniciar: z.number().int().nonnegative(),
  sesionesEnviadas: z.number().int().nonnegative(),
})
export type ResumenPlan = z.infer<typeof ResumenPlanSchema>
export const ListadoPlanesSchema = z.strictObject({ planes: z.array(ResumenPlanSchema) })
export type ListadoPlanes = z.infer<typeof ListadoPlanesSchema>

export const ResultadoAnulacionSchema = z.strictObject({
  anuladas: z.number().int().nonnegative(),
  conservadas: z.number().int().nonnegative(),
})
export type ResultadoAnulacion = z.infer<typeof ResultadoAnulacionSchema>

export type FechaDelPlan = {
  /** Id de la sesión dentro del patrón semanal. */
  sesionPatronId: string
  nombre: string
  semana: string
  fecha: string
}

/**
 * Las fechas concretas que genera un patrón semanal repetido.
 *
 * Vive aquí porque la usan los dos lados: el servidor al asignar y la app para
 * enseñar al entrenador qué días se van a crear antes de pulsar «Asignar».
 */
export function fechasDelPlan(
  semanaInicial: string,
  semanas: number,
  patron: PatronRutina,
): FechaDelPlan[] {
  const fechas: FechaDelPlan[] = []
  for (let indice = 0; indice < semanas; indice++) {
    const semana = sumarDias(semanaInicial, indice * 7)
    for (const sesion of patron.sesiones) {
      fechas.push({
        sesionPatronId: sesion.id,
        nombre: sesion.nombre,
        semana,
        fecha: sumarDias(semana, sesion.diaSemana - 1),
      })
    }
  }
  return fechas
    .map((fecha, orden) => ({ fecha, orden }))
    .sort((a, b) => a.fecha.fecha.localeCompare(b.fecha.fecha) || a.orden - b.orden)
    .map(({ fecha }) => fecha)
}

/** Cuántas series prescribe una sesión. */
export function seriesDe(prescripcion: Pick<Prescripcion, "ejercicios">): number {
  return prescripcion.ejercicios.reduce((total, ejercicio) => total + ejercicio.series.length, 0)
}
