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
})

export type ContenidoDelToken = z.infer<typeof ContenidoDelTokenSchema>

/**
 * Peticion HTTP con la identidad ya verificada.
 *
 * El campo lo rellena el guard leyendo el token firmado. Nunca proviene del
 * cuerpo de la peticion ni de una cabecera que pueda escribir la app: eso seria
 * dejar que el cliente eligiera su propio rol.
 */
export type PeticionAutenticada = {
  usuario?: ContenidoDelToken
  headers: Record<string, string | string[] | undefined>
}
