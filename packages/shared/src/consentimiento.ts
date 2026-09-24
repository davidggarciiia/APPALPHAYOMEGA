import { z } from "zod"

/**
 * Consentimiento explícito para tratar datos de salud (RGPD, art. 9). Peso,
 * medidas, pliegues, pruebas físicas, molestias y fotos corporales son
 * categoría especial: sin consentimiento vigente del cliente no se guarda
 * ningún dato suyo de ese tipo, lo registre él o su entrenador.
 *
 * El texto es un BORRADOR preparado por Claude. Antes de usarlo con clientes
 * reales debe revisarlo alguien con titulación jurídica (PENDIENTE-PARA-
 * PRODUCCION, punto 4). Cambiar el texto exige subir `VERSION_CONSENTIMIENTO`:
 * cada cliente vuelve a aceptar la versión nueva.
 */
export const VERSION_CONSENTIMIENTO = "2026-09-24-borrador"

export const TEXTO_CONSENTIMIENTO = {
  titulo: "Tus datos de salud",
  parrafos: [
    "Para entrenarte, tu entrenador y, si lo tienes asignado, tu nutricionista necesitan tratar datos de salud tuyos: peso, medidas y pliegues corporales, bioimpedancia, pruebas físicas, molestias, registros de sueño, pasos y alimentación, y las fotos de evolución que te pidan.",
    "Solo los usamos para planificar y seguir tu entrenamiento y tu alimentación. No los vendemos, no los usamos para publicidad y no los compartimos con nadie más. Las fotos corporales solo las ven tú y tu entrenador.",
    "Se guardan en servidores de la Unión Europea mientras seas cliente. Puedes consultarlos, pedir que se corrijan o que se borren, y retirar este consentimiento cuando quieras desde tu perfil en la app; retirarlo no afecta a lo tratado antes.",
    "Si no das tu consentimiento, la app no podrá guardar ninguno de estos datos.",
  ],
  aceptar: "Doy mi consentimiento explícito para el tratamiento de mis datos de salud",
} as const

export const EstadoConsentimientoSchema = z.strictObject({
  /** Versión del texto que el cliente aceptó, o `null` si nunca aceptó. */
  version: z.string().nullable(),
  aceptadoEn: z.iso.datetime().nullable(),
  /** Cuándo retiró esa aceptación, o `null` si sigue en pie. */
  retiradoEn: z.iso.datetime().nullable(),
  /** `true` solo si aceptó la versión vigente y no la ha retirado. */
  vigente: z.boolean(),
  versionVigente: z.string(),
})
export type EstadoConsentimiento = z.infer<typeof EstadoConsentimientoSchema>

/** El cliente acepta exactamente la versión que ha leído. */
export const AceptarConsentimientoSchema = z.strictObject({
  version: z.literal(VERSION_CONSENTIMIENTO),
  acepto: z.literal(true),
})
export type AceptarConsentimiento = z.infer<typeof AceptarConsentimientoSchema>
