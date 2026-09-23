import { z } from "zod"
import { DietaPublicadaSchema, type DietaPublicada } from "@alpha-omega/shared"
import type { AlmacenLocal } from "../entrenamiento/almacen-local"

/**
 * Copia cifrada de la última dieta vigente que vio el cliente.
 *
 * Vive en el almacén por cuenta del entrenamiento, así que cerrar sesión la
 * borra y otra cuenta del mismo móvil no la ve. Es de solo lectura: no cuenta
 * como cambio pendiente al salir.
 */
const CLAVE = "dieta-vigente"

const CopiaSchema = z.strictObject({
  dieta: DietaPublicadaSchema.nullable(),
  actualizadaEn: z.iso.datetime(),
})
export type CopiaDeDieta = z.infer<typeof CopiaSchema>

export async function guardarCopia(
  almacen: AlmacenLocal,
  cuenta: string,
  dieta: DietaPublicada | null,
  ahora: Date = new Date(),
): Promise<void> {
  await almacen.guardar(cuenta, CLAVE, { dieta, actualizadaEn: ahora.toISOString() })
}

export async function leerCopia(
  almacen: AlmacenLocal,
  cuenta: string,
): Promise<CopiaDeDieta | null> {
  return almacen.leer(cuenta, CLAVE, CopiaSchema)
}
