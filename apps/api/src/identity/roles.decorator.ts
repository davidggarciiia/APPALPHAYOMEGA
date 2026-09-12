import { SetMetadata, type CustomDecorator } from "@nestjs/common"
import type { Rol } from "@alpha-omega/shared"

export const CLAVE_ROLES = "roles_permitidos"

/**
 * Declara que roles pueden usar una ruta.
 *
 * Es obligatorio en toda ruta que no sea `@Publico()`. Una ruta sin este
 * decorador no es "accesible para cualquiera que haya entrado": es inaccesible.
 * Asi lo exige el requisito 19 de SPEC-identity.md, y por eso olvidarlo produce
 * un 403 ruidoso en vez de una puerta abierta silenciosa.
 *
 * Aplicable a un metodo o a un controlador entero. Lo mas cercano gana.
 */
export const Roles = (...roles: readonly Rol[]): CustomDecorator<string> =>
  SetMetadata(CLAVE_ROLES, roles)
