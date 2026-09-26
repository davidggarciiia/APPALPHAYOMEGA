import type { Sesion } from "@alpha-omega/shared"

import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./almacen-seguro"
import { refrescarSesion } from "./api"
import { ErrorDeSesion, pedir } from "./http"
import { borrarIdentidadLocal, guardarIdentidadLocal } from "./sesion-local"

/*
 * Credenciales en memoria y la ÚNICA puerta para renovar la sesión.
 *
 * El token de acceso lleva dentro el identificador de su token de refresco, y
 * el servidor lo mata en cuanto ese refresco rota. Por eso, al renovar, todas
 * las peticiones que iban en vuelo con el token viejo vuelven con un 401 a la
 * vez. Si cada una renovara por su cuenta presentaría un refresco ya rotado, y
 * el servidor lo interpreta como una copia robada y corta la sesión entera.
 * Aquí se renueva una sola vez y las demás esperan a ese resultado.
 */

type Evento = { tipo: "renovada"; sesion: Sesion } | { tipo: "caducada" }

let tokenAcceso: string | null = null
let tokenRefresco: string | null = null
/** Sube con cada entrada y salida. Una renovación de una generación anterior se descarta. */
let generacion = 0
let enVuelo: Promise<string> | null = null
const oyentes = new Set<(evento: Evento) => void>()

export function escucharCredenciales(oyente: (evento: Evento) => void): () => void {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

function emitir(evento: Evento): void {
  for (const oyente of oyentes) {
    oyente(evento)
  }
}

/** Tras un login: estas son las credenciales vigentes. */
export function establecerCredenciales(sesion: Sesion): void {
  generacion++
  tokenAcceso = sesion.tokenAcceso
  tokenRefresco = sesion.tokenRefresco
}

export function tokenDeAcceso(): string | null {
  return tokenAcceso
}

/** Al salir. Espera a que termine una renovación en vuelo, que ya no se aplicará. */
export async function olvidarCredenciales(): Promise<void> {
  const pendiente = enVuelo
  generacion++
  tokenAcceso = null
  tokenRefresco = null
  await pendiente?.catch(() => undefined)
}

/**
 * Devuelve un token de acceso válido.
 *
 * `tokenQueFallo` es el que recibió el 401. Si el vigente ya es otro, alguien
 * renovó mientras tanto y basta con usarlo.
 */
export function renovarAcceso(tokenQueFallo: string | null): Promise<string> {
  if (tokenAcceso !== null && tokenAcceso !== tokenQueFallo) {
    return Promise.resolve(tokenAcceso)
  }
  if (enVuelo !== null) {
    return enVuelo
  }
  const mia = generacion
  enVuelo = (async (): Promise<string> => {
    const refresco = tokenRefresco ?? (await leerTokenRefresco())
    if (refresco === null) {
      throw new ErrorDeSesion("Sin sesión guardada")
    }
    let sesion: Sesion
    try {
      sesion = await refrescarSesion(refresco)
    } catch (error) {
      if (error instanceof ErrorDeSesion && mia === generacion) {
        // Caducada, revocada o cuenta desactivada. Una caída de red NO pasa por aquí.
        tokenAcceso = null
        tokenRefresco = null
        await borrarTokenRefresco()
        await borrarIdentidadLocal()
        emitir({ tipo: "caducada" })
      }
      throw error
    }
    if (mia !== generacion) {
      throw new ErrorDeSesion("La sesión se cerró durante la renovación")
    }
    tokenRefresco = sesion.tokenRefresco
    // El refresco nuevo se guarda ANTES de usarlo: si la app muriera ahora, al
    // volver presentaría el viejo y el servidor lo tomaría por una copia.
    await guardarTokenRefresco(sesion.tokenRefresco).catch(() => undefined)
    await guardarIdentidadLocal(sesion.usuario).catch(() => undefined)
    tokenAcceso = sesion.tokenAcceso
    emitir({ tipo: "renovada", sesion })
    return sesion.tokenAcceso
  })().finally(() => {
    enVuelo = null
  })
  return enVuelo
}

function conToken(opciones: RequestInit, token: string): RequestInit {
  return { ...opciones, headers: { ...opciones.headers, Authorization: `Bearer ${token}` } }
}

/**
 * Petición autenticada que sobrevive a un token caducado.
 *
 * Un 401 significa que el servidor la rechazó antes de ejecutar nada, así que
 * repetirla una vez con el token nuevo es seguro para cualquier método. Un
 * fallo de red no se reintenta aquí: eso lo decide quien llama, con su id de
 * operación.
 */
export async function pedirAutenticado(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
  let token = tokenAcceso ?? (await renovarAcceso(null))
  try {
    return await pedir(ruta, conToken(opciones, token))
  } catch (error) {
    if (!(error instanceof ErrorDeSesion)) {
      throw error
    }
    token = await renovarAcceso(token)
    return pedir(ruta, conToken(opciones, token))
  }
}
