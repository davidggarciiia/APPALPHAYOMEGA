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

export { ErrorDePermiso, ErrorDeRed, ErrorDelServidor, ErrorDeSesion } from "./http"

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

/** Da de alta a alguien. Es la unica via por la que nace una cuenta. */
export async function crearUsuario(
  tokenAcceso: string,
  datos: CrearUsuario,
): Promise<UsuarioCreado> {
  return UsuarioCreadoSchema.parse(
    await pedir("/usuarios", {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
      body: JSON.stringify(datos),
    }),
  )
}

/** La ficha completa de una persona de la cartera. */
export async function leerUsuario(tokenAcceso: string, id: string): Promise<FichaDeUsuario> {
  return FichaDeUsuarioSchema.parse(
    await pedir(`/usuarios/${id}`, { headers: { Authorization: `Bearer ${tokenAcceso}` } }),
  )
}

/** Corrige los datos de contacto. El rol, el estado y el correo no viajan aqui. */
export async function guardarUsuario(
  tokenAcceso: string,
  id: string,
  cambios: CambiosDeUsuario,
): Promise<FichaDeUsuario> {
  return FichaDeUsuarioSchema.parse(
    await pedir(`/usuarios/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
      body: JSON.stringify(cambios),
    }),
  )
}

/** Corrige un correo mal tecleado. Solo mientras esa persona siga pendiente. */
export async function corregirCorreo(
  tokenAcceso: string,
  id: string,
  email: string,
): Promise<FichaDeUsuario> {
  return FichaDeUsuarioSchema.parse(
    await pedir(`/usuarios/${id}/correo`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
      body: JSON.stringify({ email }),
    }),
  )
}

/** Vuelve a mandar el enlace de activacion. El anterior deja de valer. */
export async function reenviarActivacion(
  tokenAcceso: string,
  id: string,
): Promise<ResultadoDeEnvio> {
  return ResultadoDeEnvioSchema.parse(
    await pedir(`/usuarios/${id}/reenviar-activacion`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
    }),
  )
}

/** Da de baja. No borra: el historico se conserva entero. */
export async function desactivarUsuario(tokenAcceso: string, id: string): Promise<FichaDeUsuario> {
  return FichaDeUsuarioSchema.parse(
    await pedir(`/usuarios/${id}/desactivar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
    }),
  )
}

/** Deshace una baja. Quien nunca activo vuelve a pendiente, no a activo. */
export async function reactivarUsuario(tokenAcceso: string, id: string): Promise<FichaDeUsuario> {
  return FichaDeUsuarioSchema.parse(
    await pedir(`/usuarios/${id}/reactivar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenAcceso}` },
    }),
  )
}

/** A quien ve un nutricionista. Solo identificadores. */
export async function leerAsignaciones(
  tokenAcceso: string,
  nutricionistaId: string,
): Promise<AsignacionesDeNutricionista> {
  return AsignacionesDeNutricionistaSchema.parse(
    await pedir(`/nutricionistas/${nutricionistaId}/clientes`, {
      headers: { Authorization: `Bearer ${tokenAcceso}` },
    }),
  )
}

/** Da acceso a un cliente. Asignar dos veces no crea dos filas. */
export async function asignarCliente(
  tokenAcceso: string,
  nutricionistaId: string,
  clienteId: string,
): Promise<void> {
  await pedir(`/nutricionistas/${nutricionistaId}/clientes/${clienteId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  })
}

/** Retira el acceso. Surte efecto en la peticion siguiente. */
export async function retirarCliente(
  tokenAcceso: string,
  nutricionistaId: string,
  clienteId: string,
): Promise<void> {
  await pedir(`/nutricionistas/${nutricionistaId}/clientes/${clienteId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokenAcceso}` },
  })
}

/** La lista del propio nutricionista. Sale del token, no de la ruta. */
export async function listarMisClientes(tokenAcceso: string): Promise<ListadoUsuarios> {
  return ListadoUsuariosSchema.parse(
    await pedir("/mis-clientes", { headers: { Authorization: `Bearer ${tokenAcceso}` } }),
  )
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
