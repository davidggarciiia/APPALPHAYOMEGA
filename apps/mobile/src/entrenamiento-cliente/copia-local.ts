import { z } from "zod"
import {
  EjercicioSchema,
  EnviarEntrenamientoSchema,
  GuardarBorradorSchema,
  ResultadoEntrenamientoSchema,
  SesionClienteSchema,
} from "@alpha-omega/shared"

/**
 * Lo que el móvil guarda de cada sesión, por cuenta.
 *
 * Los valores se guardan como el texto que escribió la persona («42,» sigue
 * siendo «42,» mientras teclea); se convierten a números solo al sincronizar.
 */
export const EntradaSerieSchema = z.object({
  peso: z.string().max(20),
  valor: z.string().max(20),
  hecha: z.boolean(),
})
export type EntradaSerie = z.infer<typeof EntradaSerieSchema>
export type Entradas = Record<string, EntradaSerie>

const EntradasSchema = z.record(z.string(), EntradaSerieSchema)

export const CopiaLocalSchema = z.object({
  v: z.literal(1),
  sesionId: z.string(),
  /** La última versión conocida del servidor: prescripción, fechas y estado. */
  sesion: SesionClienteSchema,
  /** Fichas de los ejercicios, para leer instrucciones sin cobertura. */
  ejercicios: z.array(EjercicioSchema).nullable(),
  entradas: EntradasSchema,
  notas: z.string().max(2000),
  /** Cada edición local suma uno. */
  secuencia: z.number().int().nonnegative(),
  /** Hasta qué edición confirmó el servidor. */
  sincronizada: z.number().int().nonnegative(),
  /** Revisiones del servidor sobre las que se escribe. */
  base: z.object({ prescripcion: z.number().int(), borrador: z.number().int() }),
  /** Guardado enviado cuya respuesta no llegó: se reenvía idéntico antes que nada. */
  enVuelo: z.object({ cuerpo: GuardarBorradorSchema, secuencia: z.number().int() }).nullable(),
  /** Envío pendiente de confirmar: el reintento lleva la misma operación. */
  envio: z.object({ cuerpo: EnviarEntrenamientoSchema }).nullable(),
  conflicto: z
    .object({
      codigo: z.string(),
      mensaje: z.string(),
      servidor: SesionClienteSchema.nullable(),
    })
    .nullable(),
  /** Lo que había en el móvil al elegir la versión del servidor. No se pierde. */
  respaldo: z.object({ entradas: EntradasSchema, notas: z.string() }).nullable(),
  resultado: ResultadoEntrenamientoSchema.nullable(),
  /** El entrenador anuló la sesión: se conserva lo local hasta que se descarte. */
  anulada: z.boolean(),
  actualizadaEn: z.string(),
})
export type CopiaLocal = z.infer<typeof CopiaLocalSchema>

/** Si esta copia tiene algo que el servidor todavía no sabe. */
export function tienePendientes(copia: CopiaLocal): boolean {
  return (
    copia.resultado === null &&
    !copia.anulada &&
    (copia.secuencia > copia.sincronizada || copia.enVuelo !== null || copia.envio !== null)
  )
}
