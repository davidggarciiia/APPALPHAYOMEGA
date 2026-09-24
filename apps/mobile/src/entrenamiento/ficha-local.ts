import { z } from "zod"
import { EjercicioSchema, type Ejercicio } from "@alpha-omega/shared"
import type { AlmacenLocal } from "./almacen-local"

/**
 * Copia cifrada de la ficha de un ejercicio que el cliente ya consultó, para
 * ver su técnica sin red. Solo guarda texto y la referencia a la figura: el vídeo
 * lo guarda el reproductor en su propia caché, nunca dentro de este JSON.
 *
 * No empieza por `plan-` ni `sesion-`: no cuenta como cambio pendiente al salir.
 */
const CopiaSchema = z.strictObject({ ejercicio: EjercicioSchema, guardadaEn: z.iso.datetime() })

export function claveFicha(ejercicioId: string): string {
  return `ficha-${z.uuid().parse(ejercicioId)}`
}

export async function guardarFicha(
  almacen: AlmacenLocal,
  cuenta: string,
  ejercicio: Ejercicio,
  ahora: Date = new Date(),
): Promise<void> {
  await almacen.guardar(cuenta, claveFicha(ejercicio.id), {
    ejercicio,
    guardadaEn: ahora.toISOString(),
  })
}

export async function leerFicha(
  almacen: AlmacenLocal,
  cuenta: string,
  ejercicioId: string,
): Promise<Ejercicio | null> {
  return (await almacen.leer(cuenta, claveFicha(ejercicioId), CopiaSchema))?.ejercicio ?? null
}
