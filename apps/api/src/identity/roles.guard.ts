import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { Rol } from "@alpha-omega/shared"

import type { PeticionAutenticada } from "./peticion.js"
import { CLAVE_PUBLICO } from "./publico.decorator.js"
import { CLAVE_ROLES } from "./roles.decorator.js"

/**
 * Segunda capa de permisos: ya sabemos quien eres, ahora si puedes.
 *
 * Corre despues del guard de autenticacion, asi que puede contar con que la
 * peticion trae un usuario verificado. Su regla es deliberadamente severa: sin
 * `@Roles(...)` declarado, deniega. No existe un "por defecto lo puede usar
 * cualquiera que haya iniciado sesion", porque ese valor por defecto es como se
 * cuela un endpoint que el nutricionista externo no deberia ver.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const esPublica = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ])

    if (esPublica === true) {
      return true
    }

    const permitidos = this.reflector.getAllAndOverride<readonly Rol[]>(CLAVE_ROLES, [
      contexto.getHandler(),
      contexto.getClass(),
    ])

    if (permitidos === undefined || permitidos.length === 0) {
      throw new ForbiddenException("Esta ruta no declara que roles pueden usarla")
    }

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>()
    const usuario = peticion.usuario

    if (usuario === undefined || !permitidos.includes(usuario.rol)) {
      throw new ForbiddenException("Tu perfil no puede usar esta ruta")
    }

    return true
  }
}
