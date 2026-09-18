import { ErrorDeApiSchema, type ErrorDeApi } from "@alpha-omega/shared"
import type { z } from "zod"
import { direccionDeLaApi } from "./direccion-api"

const LIMITE_MS = 10_000

/** Solo 401 indica que la credencial fue rechazada. */
export class ErrorDeSesion extends Error {}

/** Un 403 conserva la sesión: el rol no tiene permiso para esta operación. */
export class ErrorDePermiso extends Error {}

/** Red o tiempo agotado: no se debe borrar la credencial guardada. */
export class ErrorDeRed extends Error {}

export class ErrorDelServidor extends Error {
  constructor(readonly codigo: number) {
    super(`El servidor respondio ${String(codigo)}`)
  }
}

/** Conserva el estado numérico que usa identidad y añade el detalle de dominio. */
export class ErrorDePeticion extends ErrorDelServidor {
  constructor(readonly detalle: ErrorDeApi) {
    super(detalle.statusCode)
    this.message = detalle.message
  }
}

export async function pedir(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
  const controlador = new AbortController()
  const cancelar = (): void => controlador.abort()
  const headers = new Headers(opciones.headers)
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json")
  const limite = setTimeout(cancelar, LIMITE_MS)

  opciones.signal?.addEventListener("abort", cancelar)
  if (opciones.signal?.aborted) cancelar()

  try {
    let respuesta: Response
    try {
      if (controlador.signal.aborted) throw new Error("Petición cancelada")
      respuesta = await fetch(`${direccionDeLaApi()}${ruta}`, {
        ...opciones,
        signal: controlador.signal,
        headers,
      })
    } catch (error) {
      throw new ErrorDeRed(error instanceof Error ? error.message : "Sin conexion")
    }

    if (respuesta.status === 401) throw new ErrorDeSesion("401")
    if (respuesta.status === 403) throw new ErrorDePermiso("403")
    if (!respuesta.ok) {
      if (respuesta.status === 400 || respuesta.status === 409) {
        const cuerpo: unknown = await leerJson(respuesta).catch((error: unknown) => {
          if (error instanceof ErrorDeRed) throw error
          return null
        })
        const error = ErrorDeApiSchema.safeParse(cuerpo)
        if (error.success && error.data.statusCode === respuesta.status) {
          throw new ErrorDePeticion(error.data)
        }
      }
      throw new ErrorDelServidor(respuesta.status)
    }
    if (respuesta.status === 204) return null

    return await leerJson(respuesta)
  } finally {
    clearTimeout(limite)
    opciones.signal?.removeEventListener("abort", cancelar)
  }
}

async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json()
  } catch (error) {
    // Algunos entornos entregan errores de otro contexto JavaScript.
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "SyntaxError"
    ) {
      throw error
    }
    throw new ErrorDeRed(error instanceof Error ? error.message : "Conexión interrumpida")
  }
}

export async function pedirJson<T>(
  ruta: string,
  esquema: z.ZodType<T>,
  opciones: RequestInit = {},
): Promise<T> {
  return esquema.parse(await pedir(ruta, opciones))
}
