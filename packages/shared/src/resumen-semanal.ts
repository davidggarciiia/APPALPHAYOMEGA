import { z } from "zod"
import { FechaAgendaSchema, SemanaSchema } from "./agenda"
import { ZonaDeMolestiaSchema } from "./molestias"

/** Mejor serie enviada; la fecha es la actual de agenda, como en «Fuerza». */
export const SerieResumenSemanalSchema = z.strictObject({
  sesionId: z.uuid(),
  fecha: FechaAgendaSchema,
  pesoKg: z.number().positive().max(1000),
  repeticiones: z.number().int().min(1).max(10000),
  rir: z.number().int().min(0).max(5).nullable(),
  estimado1RM: z.number().positive(),
})
export type SerieResumenSemanal = z.infer<typeof SerieResumenSemanalSchema>

/** GET /entrenamiento/resumen-semanal, consultado con ConsultarSemanaSchema. */
export const ResumenSemanalSchema = z.strictObject({
  semana: SemanaSchema,
  clientes: z.array(
    z.strictObject({
      clienteId: z.uuid(),
      nombre: z.string(),
      apellidos: z.string().nullable(),
      sesionesPrevistas: z.number().int().nonnegative(),
      sesionesEnviadas: z.number().int().nonnegative(),
      ejercicios: z.array(
        z.strictObject({
          ejercicioId: z.uuid(),
          nombre: z.string(),
          mejorSerie: SerieResumenSemanalSchema.nullable(),
          mejorSerieAnterior: SerieResumenSemanalSchema.nullable(),
          comparacion: z
            .strictObject({
              direccion: z.enum(["sube", "igual", "baja"]),
              diferenciaKg: z.number(),
              diferenciaRepeticiones: z.number().int(),
              diferencia1RM: z.number(),
            })
            .nullable(),
          estado: z.enum(["Progresa", "Estancado", "Baja"]).nullable(),
          /** Supera el histórico anterior por kg y luego reps; la primera marca también cuenta. */
          record: z.boolean(),
        }),
      ),
      /** Avisos explícitos abiertos hoy y creados antes del fin de semana, incluso sin resultado. */
      molestiasAbiertas: z.array(
        z.strictObject({
          id: z.uuid(),
          sesionId: z.uuid(),
          zona: ZonaDeMolestiaSchema,
          intensidad: z.number().int().min(0).max(10),
          nivel: z.enum(["verde", "ambar", "rojo"]),
          creadaEn: z.iso.datetime(),
        }),
      ),
    }),
  ),
})
export type ResumenSemanal = z.infer<typeof ResumenSemanalSchema>
