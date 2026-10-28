import { z } from "zod"
import {
  AsignacionesDeNutricionistaSchema,
  EstadoSaludSchema,
  FichaDeUsuarioSchema,
  ListadoUsuariosSchema,
  PerfilPropioSchema,
  ResultadoDeEnvioSchema,
  SesionSchema,
  UsuarioCreadoSchema,
  type AsignacionesDeNutricionista,
  type CambiosDePerfil,
  type CambiosDeUsuario,
  type CrearUsuario,
  type Credenciales,
  type EstadoSalud,
  type FichaDeUsuario,
  type FiltrosDeListado,
  type ListadoUsuarios,
  type PerfilPropio,
  type ResultadoDeEnvio,
  type Sesion,
  type UsuarioCreado,
} from "@alpha-omega/shared"

import { pedir } from "./http"
import type { PeticionAutenticada } from "./peticion-autenticada"

export { ErrorDeSesion, ErrorDePermiso, ErrorDeRed, ErrorDelServidor } from "./http"

const SinContenidoSchema = z.unknown().transform(() => undefined)

/** Toda respuesta se valida con su contrato antes de llegar a una pantalla. */
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

export async function leerPerfil(peticion: PeticionAutenticada): Promise<PerfilPropio> {
  return peticion("/perfil", PerfilPropioSchema)
}

export async function guardarPerfil(
  peticion: PeticionAutenticada,
  cambios: CambiosDePerfil,
): Promise<PerfilPropio> {
  return peticion("/perfil", PerfilPropioSchema, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  })
}

/**
 * La cartera que ve el entrenador.
 *
 * Los filtros vacios no se envian. Mandar `buscar=` o `rol=` sin valor haria que
 * el servidor rechazara la peticion entera por no tener la forma esperada.
 */
export async function listarUsuarios(
  peticion: PeticionAutenticada,
  filtros: FiltrosDeListado,
): Promise<ListadoUsuarios> {
  const consulta = new URLSearchParams()

  if (filtros.buscar !== undefined && filtros.buscar !== "") consulta.set("buscar", filtros.buscar)
  if (filtros.rol !== undefined) consulta.set("rol", filtros.rol)
  if (filtros.estado !== undefined) consulta.set("estado", filtros.estado)
  consulta.set("limite", String(filtros.limite))
  consulta.set("desde", String(filtros.desde))

  return peticion(`/usuarios?${consulta.toString()}`, ListadoUsuariosSchema, {})
}

/** Da de alta a alguien. Es la unica via por la que nace una cuenta. */
export async function crearUsuario(
  peticion: PeticionAutenticada,
  datos: CrearUsuario,
): Promise<UsuarioCreado> {
  return peticion("/usuarios", UsuarioCreadoSchema, {
    method: "POST",
    body: JSON.stringify(datos),
  })
}

/** La ficha completa de una persona de la cartera. */
export async function leerUsuario(
  peticion: PeticionAutenticada,
  id: string,
): Promise<FichaDeUsuario> {
  return peticion(`/usuarios/${id}`, FichaDeUsuarioSchema)
}

/** Corrige los datos de contacto. El rol, el estado y el correo no viajan aqui. */
export async function guardarUsuario(
  peticion: PeticionAutenticada,
  id: string,
  cambios: CambiosDeUsuario,
): Promise<FichaDeUsuario> {
  return peticion(`/usuarios/${id}`, FichaDeUsuarioSchema, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  })
}

/** Corrige un correo mal tecleado. Solo mientras esa persona siga pendiente. */
export async function corregirCorreo(
  peticion: PeticionAutenticada,
  id: string,
  email: string,
): Promise<FichaDeUsuario> {
  return peticion(`/usuarios/${id}/correo`, FichaDeUsuarioSchema, {
    method: "PATCH",
    body: JSON.stringify({ email }),
  })
}

/** Vuelve a mandar el enlace de activacion. El anterior deja de valer. */
export async function reenviarActivacion(
  peticion: PeticionAutenticada,
  id: string,
): Promise<ResultadoDeEnvio> {
  return peticion(`/usuarios/${id}/reenviar-activacion`, ResultadoDeEnvioSchema, {
    method: "POST",
  })
}

/** Da de baja. No borra: el historico se conserva entero. */
export async function desactivarUsuario(
  peticion: PeticionAutenticada,
  id: string,
): Promise<FichaDeUsuario> {
  return peticion(`/usuarios/${id}/desactivar`, FichaDeUsuarioSchema, {
    method: "POST",
  })
}

/** Deshace una baja. Quien nunca activo vuelve a pendiente, no a activo. */
export async function reactivarUsuario(
  peticion: PeticionAutenticada,
  id: string,
): Promise<FichaDeUsuario> {
  return peticion(`/usuarios/${id}/reactivar`, FichaDeUsuarioSchema, {
    method: "POST",
  })
}

/** A quien ve un nutricionista. Solo identificadores. */
export async function leerAsignaciones(
  peticion: PeticionAutenticada,
  nutricionistaId: string,
): Promise<AsignacionesDeNutricionista> {
  return peticion(
    `/nutricionistas/${nutricionistaId}/clientes`,
    AsignacionesDeNutricionistaSchema,
    {},
  )
}

/** Da acceso a un cliente. Asignar dos veces no crea dos filas. */
export async function asignarCliente(
  peticion: PeticionAutenticada,
  nutricionistaId: string,
  clienteId: string,
): Promise<void> {
  await peticion(`/nutricionistas/${nutricionistaId}/clientes/${clienteId}`, SinContenidoSchema, {
    method: "PUT",
  })
}

/** Retira el acceso. Surte efecto en la peticion siguiente. */
export async function retirarCliente(
  peticion: PeticionAutenticada,
  nutricionistaId: string,
  clienteId: string,
): Promise<void> {
  await peticion(`/nutricionistas/${nutricionistaId}/clientes/${clienteId}`, SinContenidoSchema, {
    method: "DELETE",
  })
}

/** La lista del propio nutricionista. Sale del token, no de la ruta. */
export async function listarMisClientes(peticion: PeticionAutenticada): Promise<ListadoUsuarios> {
  return peticion("/mis-clientes", ListadoUsuariosSchema)
}

/**
 * Pide un enlace para volver a entrar.
 *
 * No devuelve nada y nunca falla por el correo: el servidor responde igual
 * exista o no la cuenta, y la app no puede convertirse en el oraculo que el
 * servidor evita ser.
 */
export async function pedirEnlaceDeRecuperacion(email: string): Promise<void> {
  await pedir("/auth/recuperar", { method: "POST", body: JSON.stringify({ email }) })
}

/** Fija la contrasena nueva con el enlace del correo. Cierra las demas sesiones. */
export async function restablecerContrasena(token: string, contrasena: string): Promise<void> {
  await pedir("/auth/restablecer", {
    method: "POST",
    body: JSON.stringify({ token, contrasena }),
  })
}
