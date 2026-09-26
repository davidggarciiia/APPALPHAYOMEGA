import { z } from "zod"

/**
 * Motivos de un 409 que la app sabe tratar.
 *
 * El código dice qué hacer; el mensaje, qué enseñar. La app nunca decide por el
 * texto del mensaje, que puede cambiar de redacción sin avisar.
 */
export const CODIGOS_DE_ERROR = [
  "prescripcion_cambiada",
  "borrador_cambiado",
  "sesion_enviada",
  "sesion_cerrada",
  "sesion_iniciada",
  "revision_obsoleta",
  "operacion_reutilizada",
  "fuera_de_semana",
  "cliente_no_disponible",
  "ejercicio_no_disponible",
  "nombre_duplicado",
  "rutina_cambiada",
] as const
export const CodigoDeErrorSchema = z.enum(CODIGOS_DE_ERROR)
export type CodigoDeError = z.infer<typeof CodigoDeErrorSchema>

/** Cuerpo de un error de la API. No estricto: Nest añade `statusCode` y `error`. */
export const ErrorDeApiSchema = z.object({
  codigo: CodigoDeErrorSchema.optional(),
  mensaje: z.string().optional(),
  message: z.union([z.string(), z.array(z.string())]).optional(),
  campos: z.array(z.string()).optional(),
  actual: z.unknown().optional(),
  ejercicioId: z.uuid().optional(),
  ids: z.array(z.uuid()).optional(),
})
export type ErrorDeApi = z.infer<typeof ErrorDeApiSchema>
