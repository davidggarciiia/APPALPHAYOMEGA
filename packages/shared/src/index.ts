import { z } from "zod"

/**
 * Vocabulario y contratos compartidos por la app y el servidor.
 *
 * Definidos una sola vez aqui. Si manana aparece un quinto rol, se cambia en
 * este fichero y el compilador senala cada sitio de los dos lados que hay que
 * tocar.
 *
 * Los contratos se escriben como esquemas de Zod y el tipo se deriva de ellos,
 * no al reves. Asi el mismo objeto sirve para comprobar en tiempo de ejecucion
 * lo que llega por la red y para tipar el codigo que lo usa.
 */

/** Los cuatro perfiles de SPEC-identity.md. No hay mas y no se anaden a la ligera. */
export const ROLES = ["cliente", "entrenador", "nutricionista", "empleado"] as const

export const RolSchema = z.enum(ROLES)
export type Rol = z.infer<typeof RolSchema>

/**
 * Existir y poder entrar son dos cosas distintas.
 *
 * - `pendiente`: el entrenador ha creado el perfil. Existe, se le pueden asignar
 *   entrenos y dietas, y todavia no puede iniciar sesion porque no tiene contrasena.
 * - `activo`: ha completado la activacion y entra con normalidad.
 * - `desactivado`: no entra, y su historico se conserva intacto.
 */
export const ESTADOS_USUARIO = ["pendiente", "activo", "desactivado"] as const

export const EstadoUsuarioSchema = z.enum(ESTADOS_USUARIO)
export type EstadoUsuario = z.infer<typeof EstadoUsuarioSchema>

/** Comprueba si un valor cualquiera es un rol valido. Util al leer datos de fuera. */
export function esRol(valor: unknown): valor is Rol {
  return RolSchema.safeParse(valor).success
}

/**
 * Respuesta de GET /salud.
 *
 * Vive aqui y no en el servidor porque es un contrato entre las dos partes: el
 * servidor lo produce y la app lo consume. Si cambia la forma, el compilador
 * rompe en los dos lados a la vez, que es justo lo que queremos.
 */
export const EstadoSaludSchema = z.object({
  estado: z.enum(["ok", "degradado"]),
  baseDeDatos: z.enum(["ok", "sin respuesta"]),
})

export type EstadoSalud = z.infer<typeof EstadoSaludSchema>

/**
 * Lo que la app envia a POST /auth/login.
 *
 * El limite de longitud no es cosmetico: sin el, alguien puede mandar una
 * contrasena de megabytes y obligar al servidor a calcular su hash, que es una
 * operacion cara a proposito. Eso es una denegacion de servicio gratuita.
 */
export const CredencialesSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  contrasena: z.string().min(1).max(200),
})

export type Credenciales = z.infer<typeof CredencialesSchema>

/** Datos del usuario que la app puede ver. Nunca incluye el hash de contrasena. */
export const UsuarioPublicoSchema = z.object({
  id: z.string(),
  email: z.string(),
  rol: RolSchema,
})

export type UsuarioPublico = z.infer<typeof UsuarioPublicoSchema>

/**
 * Lo que devuelve POST /auth/login.
 *
 * Dos tokens con papeles distintos. El de acceso dura minutos y viaja en cada
 * peticion. El de refresco dura semanas, vive en el almacen seguro del
 * dispositivo y solo se usa para pedir un token de acceso nuevo.
 */
export const SesionSchema = z.object({
  tokenAcceso: z.string().min(1),
  tokenRefresco: z.string().min(1),
  usuario: UsuarioPublicoSchema,
})

export type Sesion = z.infer<typeof SesionSchema>

/** Cuerpo de POST /auth/refresh y POST /auth/logout. */
export const PeticionRefrescoSchema = z.object({
  tokenRefresco: z.string().min(1).max(500),
})

export type PeticionRefresco = z.infer<typeof PeticionRefrescoSchema>
