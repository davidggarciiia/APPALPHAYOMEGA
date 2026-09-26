import { jest } from "@jest/globals"
import type { z } from "zod"

import type { PeticionAutenticada } from "../../lib/peticion-autenticada"

export type Llamada = { metodo: string; ruta: string; cuerpo: unknown }
export type Respuesta = unknown | ((llamada: Llamada) => unknown)

/**
 * `pedir` falso para las pruebas de pantalla: contesta por «MÉTODO /ruta» (sin
 * la consulta) y valida cada respuesta con el esquema real, así que un dato de
 * prueba que no cumple el contrato rompe la prueba. Una respuesta puede ser una
 * función que recibe la llamada, y puede lanzar el error que haga falta.
 */
export function servidorFalso(respuestas: Record<string, Respuesta>): {
  pedir: PeticionAutenticada
  llamadas: Llamada[]
  respuestas: Record<string, Respuesta>
  /** Las llamadas a una ruta con ese método y sin la consulta. */
  a: (clave: string) => Llamada[]
} {
  const llamadas: Llamada[] = []
  const pedir = jest.fn(
    async (ruta: string, esquema: z.ZodType<unknown>, opciones: RequestInit = {}) => {
      const metodo = (opciones.method ?? "GET").toUpperCase()
      const cuerpo: unknown =
        typeof opciones.body === "string" ? JSON.parse(opciones.body) : undefined
      const llamada = { metodo, ruta, cuerpo }
      llamadas.push(llamada)
      const clave = `${metodo} ${ruta.split("?")[0] ?? ruta}`
      if (!(clave in respuestas)) throw new Error(`Sin respuesta de prueba para ${clave}`)
      const respuesta = respuestas[clave]
      const valor: unknown =
        typeof respuesta === "function"
          ? await (respuesta as (llamada: Llamada) => unknown)(llamada)
          : respuesta
      return esquema.parse(valor)
    },
  )
  return {
    pedir: pedir as unknown as PeticionAutenticada,
    llamadas,
    respuestas,
    a: (clave) => llamadas.filter((l) => `${l.metodo} ${l.ruta.split("?")[0] ?? l.ruta}` === clave),
  }
}
