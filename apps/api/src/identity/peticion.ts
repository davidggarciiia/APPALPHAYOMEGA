import { z } from "zod"
import { RolSchema } from "@alpha-omega/shared"

/**
 * Contenido del token de sesion, tal y como lo firma el servidor.
 *
 * Se valida con Zod al leerlo aunque la firma ya sea correcta. Una firma valida
 * demuestra que el token lo emitimos nosotros, no que su contenido tenga la
 * forma que el codigo de hoy espera: un token emitido por una version anterior
 * sigue siendo valido y puede traer otra cosa.
 */
export const ContenidoDelTokenSchema = z.object({
  sub: z.string().min(1),
  rol: RolSchema,
  /**
   * Identificador de la sesion: la fila de `tokens_refresco` que nacio con este
   * login.
   *
   * Sin el, un token de acceso es un papel autofirmado que nadie puede retirar:
   * sobrevive al cierre de sesion y a la desactivacion de la cuenta hasta que
   * caduca solo. Con el, el servidor puede comprobar en cada peticion si esa
   * sesion sigue viva.
   */
  sid: z.string().min(1),
})

export type ContenidoDelToken = z.infer<typeof ContenidoDelTokenSchema>

/**
 * Identidad ya verificada que el guard deja en la peticion.
 *
 * El rol de aqui NO es el que venia en el token: es el que tiene el usuario en
 * la base de datos ahora mismo. Un cambio de rol surte efecto en la siguiente
 * peticion, no cuando caduque el token.
 */
export type IdentidadVerificada = {
  sub: string
  rol: ContenidoDelToken["rol"]
  sid: string
}

/**
 * Peticion HTTP con la identidad ya verificada.
 *
 * El campo lo rellena el guard leyendo el token firmado y contrastandolo con la
 * base. Nunca proviene del cuerpo de la peticion ni de una cabecera que pueda
 * escribir la app: eso seria dejar que el cliente eligiera su propio rol.
 */
export type PeticionAutenticada = {
  usuario?: IdentidadVerificada
  headers: Record<string, string | string[] | undefined>
}
