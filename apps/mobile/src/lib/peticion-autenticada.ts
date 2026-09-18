import type { z } from "zod"
import { ErrorDeSesion, pedirJson } from "./http"

export type PeticionAutenticada = <T>(
  ruta: string,
  esquema: z.ZodType<T>,
  opciones?: RequestInit,
) => Promise<T>

/** C06 conectará aquí la renovación coordinada. El transporte no guarda tokens. */
export function crearPeticionAutenticada(leerToken: () => string | null): PeticionAutenticada {
  return async <T>(ruta: string, esquema: z.ZodType<T>, opciones: RequestInit = {}): Promise<T> => {
    const token = leerToken()
    if (token === null || token.trim() === "") throw new ErrorDeSesion("Sin sesión")

    const headers = new Headers(opciones.headers)
    headers.set("Authorization", `Bearer ${token}`)
    return pedirJson(ruta, esquema, { ...opciones, headers })
  }
}
