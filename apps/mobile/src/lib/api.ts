import {
  EstadoSaludSchema,
  ListadoUsuariosSchema,
  PerfilPropioSchema,
  SesionSchema,
  type CambiosDePerfil,
  type Credenciales,
  type EstadoSalud,
  type FiltrosDeListado,
  type ListadoUsuarios,
  type PerfilPropio,
  type Sesion,
} from "@alpha-omega/shared"

import { direccionDeLaApi } from "./direccion-api"

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

/** El servidor contesto, pero con un fallo suyo. */
export class ErrorDelServidor extends Error {
  constructor(readonly codigo: number) {
    super(`El servidor respondio ${String(codigo)}`)
  }
}

async function pedir(ruta: string, opciones: RequestInit = {}): Promise<unknown> {
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
    throw new ErrorDelServidor(respuesta.status)
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

export async function activarCuenta(token: string, contrasena: string): Promise<void> {
  await pedir("/auth/activar", { method: "POST", body: JSON.stringify({ token, contrasena }) })
}

export async function leerPerfil(tokenAcceso: string): Promise<PerfilPropio> {
  return PerfilPropioSchema.parse(
    await pedir("/perfil", { headers: { Authorization: `Bearer ${tokenAcceso}` } }),
  )
}

export async function guardarPerfil(
  tokenAcceso: string,
  cambios: CambiosDePerfil,
): Promise<PerfilPropio> {
  return PerfilPropioSchema.parse(
    await pedir("/perfil", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
      body: JSON.stringify(cambios),
    }),
  )
}

/**
 * La cartera que ve el entrenador.
 *
 * Los filtros vacios no se envian. Mandar `buscar=` o `rol=` sin valor haria que
 * el servidor rechazara la peticion entera por no tener la forma esperada.
 */
export async function listarUsuarios(
  tokenAcceso: string,
  filtros: FiltrosDeListado,
): Promise<ListadoUsuarios> {
  const consulta = new URLSearchParams()

  if (filtros.buscar !== undefined && filtros.buscar !== "") consulta.set("buscar", filtros.buscar)
  if (filtros.rol !== undefined) consulta.set("rol", filtros.rol)
  if (filtros.estado !== undefined) consulta.set("estado", filtros.estado)
  consulta.set("limite", String(filtros.limite))
  consulta.set("desde", String(filtros.desde))

  return ListadoUsuariosSchema.parse(
    await pedir(`/usuarios?${consulta.toString()}`, {
      headers: { Authorization: `Bearer ${tokenAcceso}` },
    }),
  )
}
