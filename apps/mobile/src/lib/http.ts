import { ErrorDeApiSchema, type ErrorDeApi } from "@alpha-omega/shared"

import { direccionDeLaApi } from "./direccion-api"

/*
 * Transporte HTTP de la app: una sola funcion que habla con el servidor y
 * traduce cada fallo a una clase de error con significado.
 */

/**
 * Cuanto se espera antes de dar una peticion por perdida.
 *
 * React Native configura su cliente HTTP de Android **sin ningun tiempo limite**.
 * Sin esto, una peticion contra una direccion inalcanzable, que es exactamente lo
 * que pasa al abrir la app fuera de la wifi de casa, no termina jamas: la app se
 * queda con la ruleta girando y la unica salida es matarla desde el gestor de
 * tareas.
 */
const LIMITE_MS = 10_000

/** El servidor rechazo la sesion o las credenciales (401). */
export class ErrorDeSesion extends Error {}

/**
 * La sesion es valida, pero ese rol no puede hacer eso (403).
 *
 * Se separa de `ErrorDeSesion` porque las consecuencias son opuestas: ante un
 * 401 hay que descartar la credencial guardada, y ante un 403 **no**, porque la
 * sesion sigue siendo buena. Confundirlos acaba echando de la app a alguien que
 * solo se ha asomado a una pantalla que no le tocaba.
 */
export class ErrorDePermiso extends Error {}

/**
 * No se pudo hablar con el servidor: sin cobertura, direccion inalcanzable o
 * demasiado lento.
 *
 * Se distingue de un error del servidor a proposito. Ante este, la sesion
 * guardada sigue siendo valida y **no hay que borrarla**: el problema es la red,
 * no la credencial.
 */
export class ErrorDeRed extends Error {}

/**
 * El servidor contesto con un error que no es de sesion ni de permiso.
 *
 * `detalle` es el cuerpo del error si trae la forma conocida. Un 409 lleva ahi
 * su `codigo`, que es lo que decide que hacer; el texto es para ensenarlo.
 */
export class ErrorDelServidor extends Error {
  constructor(
    readonly codigo: number,
    readonly detalle: ErrorDeApi | null = null,
  ) {
    super(`El servidor respondio ${String(codigo)}`)
  }

  /** El mensaje del servidor, si lo hay. */
  get mensaje(): string | null {
    const mensaje = this.detalle?.mensaje ?? this.detalle?.message
    return typeof mensaje === "string" ? mensaje : null
  }
}

async function leerDetalle(respuesta: Response): Promise<ErrorDeApi | null> {
  try {
    const cuerpo: unknown = await respuesta.json()
    const leido = ErrorDeApiSchema.safeParse(cuerpo)
    return leido.success ? leido.data : null
  } catch {
    return null
  }
}

export async function pedir(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
  let respuesta: Response

  try {
    respuesta = await fetch(`${direccionDeLaApi()}${ruta}`, {
      ...opciones,
      signal: AbortSignal.timeout(LIMITE_MS),
      headers: {
        "Content-Type": "application/json",
        ...opciones.headers,
      },
    })
  } catch (error) {
    // Aqui solo caen fallos de transporte: sin red, DNS, o el limite de tiempo.
    throw new ErrorDeRed(error instanceof Error ? error.message : "Sin conexion")
  }

  if (respuesta.status === 401) {
    throw new ErrorDeSesion("401")
  }

  if (respuesta.status === 403) {
    throw new ErrorDePermiso("403")
  }

  if (!respuesta.ok) {
    throw new ErrorDelServidor(respuesta.status, await leerDetalle(respuesta))
  }

  if (respuesta.status === 204) {
    return null
  }

  return respuesta.json()
}
