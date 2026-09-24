import { z } from "zod"

/**
 * Molestias durante el entrenamiento (Design.html, «Registrar molestia»).
 * El cliente avisa desde la sesión; el entrenador la ve en «Requiere tu
 * atención» y responde. El semáforo sigue la guía: verde sigue, ámbar para y
 * avisa, rojo termina y avisa.
 */
export const ZONAS_DE_MOLESTIA = ["hombro", "codo", "muneca", "lumbar", "otra"] as const
export const ZonaDeMolestiaSchema = z.enum(ZONAS_DE_MOLESTIA)
export type ZonaDeMolestia = z.infer<typeof ZonaDeMolestiaSchema>

export const SINTOMAS_DE_MOLESTIA = ["rigidez", "va_a_mas", "pinchazo"] as const
export const SintomaDeMolestiaSchema = z.enum(SINTOMAS_DE_MOLESTIA)
export type SintomaDeMolestia = z.infer<typeof SintomaDeMolestiaSchema>

export type NivelDeMolestia = "verde" | "ambar" | "rojo"

/** Pinchazo o irradia, o 7 o más: rojo. Va a más, o 4 o más: ámbar. El resto, verde. */
export function nivelDeMolestia(
  intensidad: number,
  sintomas: SintomaDeMolestia[],
): NivelDeMolestia {
  if (sintomas.includes("pinchazo") || intensidad >= 7) return "rojo"
  if (sintomas.includes("va_a_mas") || intensidad >= 4) return "ambar"
  return "verde"
}

const Sintomas = z
  .array(SintomaDeMolestiaSchema)
  .max(SINTOMAS_DE_MOLESTIA.length)
  .refine((lista) => new Set(lista).size === lista.length, "Hay síntomas repetidos")

export const RegistrarMolestiaSchema = z.strictObject({
  operacionId: z.uuid(),
  /** El ejercicio de la prescripción en el que apareció, si fue en uno. */
  ejercicioPrescritoId: z.uuid().nullable(),
  /** Número de serie (1, 2…), si fue en una. */
  serie: z.number().int().min(1).max(30).nullable(),
  zona: ZonaDeMolestiaSchema,
  intensidad: z.number().int().min(0).max(10),
  sintomas: Sintomas,
  nota: z.string().trim().max(1000).nullable(),
})
export type RegistrarMolestia = z.infer<typeof RegistrarMolestiaSchema>

export const MolestiaSchema = z.strictObject({
  id: z.uuid(),
  sesionId: z.uuid(),
  clienteId: z.uuid(),
  ejercicioPrescritoId: z.uuid().nullable(),
  /** Nombre del ejercicio tal como estaba prescrito cuando se avisó. */
  ejercicio: z.string().nullable(),
  serie: z.number().int().nullable(),
  zona: ZonaDeMolestiaSchema,
  intensidad: z.number().int().min(0).max(10),
  sintomas: z.array(SintomaDeMolestiaSchema),
  nivel: z.enum(["verde", "ambar", "rojo"]),
  nota: z.string().nullable(),
  creadaEn: z.iso.datetime(),
  estado: z.enum(["abierta", "atendida"]),
  respuesta: z.string().nullable(),
  atendidaEn: z.iso.datetime().nullable(),
})
export type Molestia = z.infer<typeof MolestiaSchema>

export const ListadoMolestiasSchema = z.strictObject({
  molestias: z.array(MolestiaSchema),
  total: z.number().int().nonnegative(),
})
export type ListadoMolestias = z.infer<typeof ListadoMolestiasSchema>

export const ConsultarMolestiasSchema = z.strictObject({
  estado: z.enum(["abierta", "atendida", "todas"]).default("todas"),
  limite: z.coerce.number().int().min(1).max(100).default(30),
  desplazamiento: z.coerce.number().int().min(0).max(100000).default(0),
})
export type ConsultarMolestias = z.infer<typeof ConsultarMolestiasSchema>

export const AtenderMolestiaSchema = z.strictObject({
  respuesta: z.string().trim().min(1).max(1000),
})
export type AtenderMolestia = z.infer<typeof AtenderMolestiaSchema>

export const ETIQUETA_DE_ZONA: Record<ZonaDeMolestia, string> = {
  hombro: "Hombro",
  codo: "Codo",
  muneca: "Muñeca",
  lumbar: "Lumbar",
  otra: "Otra",
}

export const ETIQUETA_DE_SINTOMA: Record<SintomaDeMolestia, string> = {
  rigidez: "Rigidez",
  va_a_mas: "Va a más",
  pinchazo: "Pinchazo o irradia",
}
