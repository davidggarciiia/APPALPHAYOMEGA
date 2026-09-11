/**
 * Vocabulario del dominio compartido por la app y el servidor.
 *
 * Definido una sola vez aqui. Si manana aparece un quinto rol, se cambia en este
 * fichero y el compilador senala cada sitio de los dos lados que hay que tocar.
 */

/** Los cuatro perfiles de SPEC-identity.md. No hay mas y no se anaden a la ligera. */
export const ROLES = ["cliente", "entrenador", "nutricionista", "empleado"] as const

export type Rol = (typeof ROLES)[number]

/**
 * Existir y poder entrar son dos cosas distintas.
 *
 * - `pendiente`: el entrenador ha creado el perfil. Existe, se le pueden asignar
 *   entrenos y dietas, y todavia no puede iniciar sesion porque no tiene contrasena.
 * - `activo`: ha completado la activacion y entra con normalidad.
 * - `desactivado`: no entra, y su historico se conserva intacto.
 */
export const ESTADOS_USUARIO = ["pendiente", "activo", "desactivado"] as const

export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number]

/** Comprueba si un valor cualquiera es un rol valido. Util al leer datos de fuera. */
export function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && (ROLES as readonly string[]).includes(valor)
}
