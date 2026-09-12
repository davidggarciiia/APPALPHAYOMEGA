import {
  EstadoSaludSchema,
  SesionSchema,
  type Credenciales,
  type EstadoSalud,
  type Sesion,
} from "@alpha-omega/shared"

/**
 * Cliente HTTP contra la API.
 *
 * La direccion no esta escrita en el codigo: sale de una variable de entorno,
 * porque cambia segun desde donde se pruebe. En un emulador de Android es una
 * direccion, en un movil fisico es la IP del ordenador en la wifi, y en
 * produccion sera el dominio.
 */
function urlBase(): string {
  const configurada = process.env.EXPO_PUBLIC_API_URL

  if (configurada === undefined || configurada === "") {
    throw new Error("Falta EXPO_PUBLIC_API_URL. Copia apps/mobile/.env.example a apps/mobile/.env.")
  }

  return configurada.replace(/\/+$/, "")
}

/** El servidor rechazo la sesion o las credenciales. */
export class ErrorDeSesion extends Error {}

async function pedir(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
  const respuesta = await fetch(`${urlBase()}${ruta}`, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      ...opciones.headers,
    },
  })

  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorDeSesion(String(respuesta.status))
  }

  if (!respuesta.ok) {
    throw new Error(`El servidor respondio ${String(respuesta.status)}`)
  }

  if (respuesta.status === 204) {
    return null
  }

  return respuesta.json()
}

/**
 * Toda respuesta se valida antes de usarse. Lo que llega por la red es dato de
 * fuera, y el tipo de TypeScript no comprueba nada en tiempo de ejecucion: sin
 * esta validacion, un cambio en el servidor se manifestaria como un fallo
 * incomprensible dentro de un componente.
 */
export async function consultarSalud(): Promise<EstadoSalud> {
  return EstadoSaludSchema.parse(await pedir("/salud"))
}

export async function iniciarSesion(credenciales: Credenciales): Promise<Sesion> {
  return SesionSchema.parse(
    await pedir("/auth/login", { method: "POST", body: JSON.stringify(credenciales) }),
  )
}

export async function refrescarSesion(tokenRefresco: string): Promise<Sesion> {
  return SesionSchema.parse(
    await pedir("/auth/refresh", { method: "POST", body: JSON.stringify({ tokenRefresco }) }),
  )
}

export async function cerrarSesionEnServidor(tokenRefresco: string): Promise<void> {
  await pedir("/auth/logout", { method: "POST", body: JSON.stringify({ tokenRefresco }) })
}
