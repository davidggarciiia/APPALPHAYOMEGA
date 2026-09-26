import { ErrorDeApiSchema, type ErrorDeApi } from "@alpha-omega/shared"

import { direccionDeLaApi } from "./direccion-api"

/**
 * Como habla la app con la API: la peticion, sus errores y la renovacion de la
 * sesion. `api.ts` describe QUE se pide; este fichero, COMO.
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
 * `detalle` es el cuerpo del error cuando trae la forma conocida. Los 409 de
 * entrenamiento, agenda y catalogo llevan ahi su `codigo`, que es lo que decide
 * que hacer; el mensaje es para ensenarlo.
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
    const leido = ErrorDeApiSchema.safeParse(await respuesta.json())
    return leido.success ? leido.data : null
  } catch {
    return null
  }
}

/** Opciones de una peticion. Las cabeceras siempre como objeto plano. */
export type Opciones = Omit<RequestInit, "headers"> & { headers?: Record<string, string> }

export async function pedir(ruta: string, opciones: Opciones = {}): Promise<unknown> {
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

/**
 * Lo que el transporte necesita de la sesion para renovarla sin que nadie tenga
 * que volver a escribir su contrasena.
 */
export type SesionDelTransporte = {
  /** El token de acceso vigente. Puede ser mas nuevo que el que uso una peticion. */
  tokenActual: () => string | null
  /**
   * Canjea el token de refresco y devuelve el de acceso nuevo. Lanza
   * `ErrorDeSesion` si el servidor ya no reconoce la sesion y `ErrorDeRed` si
   * no hay forma de preguntarle.
   */
  renovar: () => Promise<string>
}

let sesion: SesionDelTransporte | null = null
let renovacionEnVuelo: Promise<string> | null = null

/**
 * La sesion abierta se conecta aqui al entrar y se desconecta al salir.
 *
 * Desconectar tambien olvida la renovacion en vuelo. Si terminara despues, su
 * resultado ya no pertenece a nadie, y la sesion se encarga de descartarlo.
 */
export function conectarSesion(nueva: SesionDelTransporte | null): void {
  sesion = nueva
  renovacionEnVuelo = null
}

/**
 * Una sola renovacion a la vez, la comparta quien la comparta.
 *
 * No es una optimizacion. Cada renovacion rota el token de refresco en el
 * servidor, y dos canjes del mismo token en paralelo se parecen mucho a un token
 * robado: el servidor puede cortar la sesion entera. Todas las peticiones que
 * caducan a la vez esperan a la misma renovacion.
 */
function renovarUnaSolaVez(): Promise<string> {
  const conectada = sesion

  if (conectada === null) {
    return Promise.reject(new ErrorDeSesion("No hay sesion abierta"))
  }

  if (renovacionEnVuelo === null) {
    const enVuelo = conectada.renovar().finally(() => {
      if (renovacionEnVuelo === enVuelo) renovacionEnVuelo = null
    })
    renovacionEnVuelo = enVuelo
  }

  return renovacionEnVuelo
}

/**
 * Una peticion con sesion que sobrevive a que caduque el token de acceso.
 *
 * El token de acceso dura quince minutos. Si el servidor contesta 401, se
 * renueva la sesion y se repite la peticion UNA vez con el token nuevo. Un
 * segundo 401 ya no es cuestion de caducidad y llega tal cual a la pantalla.
 *
 * Repetir es seguro tambien para escrituras: en una ruta con sesion, el 401 lo
 * da el guard de autenticacion antes de que el servidor ejecute nada, asi que la
 * primera peticion no llego a hacer ningun cambio.
 *
 * Un 403 o un fallo de red nunca renuevan ni cierran nada: la sesion sigue
 * siendo buena y el problema es otro.
 */
export async function pedirAutenticado(
  ruta: string,
  tokenAcceso: string,
  opciones: Opciones = {},
): Promise<unknown> {
  try {
    return await pedir(ruta, conToken(opciones, tokenAcceso))
  } catch (error) {
    if (!(error instanceof ErrorDeSesion)) {
      throw error
    }
  }

  // Si otra peticion ya renovo mientras esta viajaba, basta con el token nuevo:
  // renovar otra vez rotaria el refresco sin ninguna necesidad.
  const vigente = sesion?.tokenActual() ?? null
  const nuevo = vigente !== null && vigente !== tokenAcceso ? vigente : await renovarUnaSolaVez()

  return pedir(ruta, conToken(opciones, nuevo))
}

function conToken(opciones: Opciones, token: string): Opciones {
  return { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } }
}

/**
 * Peticion autenticada con el token vigente de la sesion abierta.
 *
 * Para los modulos que no reciben el token de la pantalla (entrenamiento,
 * catalogo): el mismo camino que `pedirAutenticado`, con su unica renovacion
 * compartida. Sin sesion conectada (fuera, o en modo local sin red) responde
 * como una sesion ausente y no llega a salir a la red.
 */
export async function pedirConSesion(ruta: string, opciones: Opciones = {}): Promise<unknown> {
  const token = sesion?.tokenActual() ?? (await renovarUnaSolaVez())
  return pedirAutenticado(ruta, token, opciones)
}
