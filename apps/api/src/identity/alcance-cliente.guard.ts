import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common"

import { AlcanceClienteService } from "./alcance-cliente.service.js"
import type { PeticionAutenticada } from "./peticion.js"

/**
 * Envoltorio comodo de `AlcanceClienteService` para rutas que llevan el
 * identificador del cliente en la URL.
 *
 * NO es global: se pone a mano en las rutas que tratan datos de un cliente
 * concreto. Ponerlo global obligaria a excluir rutas una por una, que es otra
 * vez la regla al reves.
 */
@Injectable()
export class AlcanceClienteGuard implements CanActivate {
  constructor(private readonly alcance: AlcanceClienteService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto
      .switchToHttp()
      .getRequest<PeticionAutenticada & { params?: Record<string, string> }>()

    const usuario = peticion.usuario
    if (usuario === undefined) {
      throw new ForbiddenException("Sin identidad verificada")
    }

    const clienteId = peticion.params?.clienteId

    // Una ruta protegida con este guard y sin el parametro esperado es un error
    // de programacion. Deniega en lugar de dejar pasar, que es el fallo barato.
    if (clienteId === undefined || clienteId === "") {
      throw new ForbiddenException("La ruta no indica de que cliente se trata")
    }

    if (!(await this.alcance.puedeAcceder(usuario, clienteId))) {
      throw new ForbiddenException("No tienes acceso a los datos de este cliente")
    }

    return true
  }
}
