import { z } from "zod"
import { ErrorDeSesion, pedirJson } from "./http"

export type PeticionAutenticada = <T>(
  ruta: string,
  esquema: z.ZodType<T>,
  opciones?: RequestInit,
) => Promise<T>

type Renovacion = {
  renovar: () => Promise<string>
  epoca: () => number
  revocada?: () => Promise<void>
}

function permiteReintento(opciones: RequestInit): boolean {
  if (["GET", "HEAD"].includes((opciones.method ?? "GET").toUpperCase())) return true
  if (typeof opciones.body !== "string") return false
  try {
    return z.object({ operacionId: z.uuid() }).safeParse(JSON.parse(opciones.body)).success
  } catch {
    return false
  }
}

/** La renovación pertenece a la sesión. Este transporte no persiste credenciales. */
export function crearPeticionAutenticada(
  leerToken: () => string | null,
  renovacion?: Renovacion,
): PeticionAutenticada {
  let enVuelo: Promise<string> | null = null
  const renovar = (): Promise<string> => {
    if (!renovacion) return Promise.reject(new ErrorDeSesion("Sin sesión"))
    enVuelo ??= renovacion.renovar().finally(() => {
      enVuelo = null
    })
    return enVuelo
  }
  return async <T>(ruta: string, esquema: z.ZodType<T>, opciones: RequestInit = {}): Promise<T> => {
    const epoca = renovacion?.epoca()
    const comprobar = (): void => {
      if (epoca !== renovacion?.epoca()) throw new ErrorDeSesion("La sesión ha cambiado")
    }
    let token = leerToken()
    if (!token) token = await renovar()
    comprobar()
    const intentar = async (actual: string): Promise<T> => {
      const headers = new Headers(opciones.headers)
      headers.set("Authorization", `Bearer ${actual}`)
      const resultado = await pedirJson(ruta, esquema, { ...opciones, headers })
      comprobar()
      return resultado
    }
    try {
      return await intentar(token)
    } catch (error) {
      comprobar()
      if (!(error instanceof ErrorDeSesion) || !renovacion) throw error
      const vigente = leerToken()
      const nuevo = vigente && vigente !== token ? vigente : await renovar()
      comprobar()
      if (!permiteReintento(opciones))
        throw new Error("Acceso renovado. Reintenta la acción para confirmarla.")
      try {
        return await intentar(nuevo)
      } catch (reintento) {
        comprobar()
        if (reintento instanceof ErrorDeSesion) await renovacion.revocada?.()
        throw reintento
      }
    }
  }
}
