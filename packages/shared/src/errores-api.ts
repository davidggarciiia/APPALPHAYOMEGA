import { z } from "zod"

const MensajeSchema = z.string().trim().min(1).max(1000)

/** Errores de los módulos nuevos. Identidad conserva sus respuestas existentes. */
export const ErrorDeApiSchema = z.discriminatedUnion("statusCode", [
  z.strictObject({
    statusCode: z.literal(400),
    codigo: z.literal("solicitud_invalida"),
    message: MensajeSchema,
  }),
  z.strictObject({
    statusCode: z.literal(409),
    codigo: z.enum([
      "nombre_duplicado",
      "revision_obsoleta",
      "operacion_incompatible",
      "estado_incompatible",
      "consentimiento_pendiente",
    ]),
    message: MensajeSchema,
  }),
])

export type ErrorDeApi = z.infer<typeof ErrorDeApiSchema>
