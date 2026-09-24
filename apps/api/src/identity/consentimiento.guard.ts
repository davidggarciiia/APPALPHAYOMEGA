import {
  ConflictException,
  Injectable,
  SetMetadata,
  type CanActivate,
  type CustomDecorator,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"

import { ConsentimientoService } from "./consentimiento.service.js"
import type { PeticionAutenticada } from "./peticion.js"

const CLAVE = "requiere_consentimiento_salud"

/**
 * Marca una ruta que guarda datos de salud de un cliente. Sin su consentimiento
 * vigente responde 409 `consentimiento_pendiente`, lo registre él o su equipo.
 */
export const RequiereConsentimientoDeSalud = (): CustomDecorator<string> => SetMetadata(CLAVE, true)

/**
 * El cliente se toma de la ruta (`:clienteId`), del cuerpo (`clienteId`) o, si
 * quien escribe es el propio cliente, de su identidad verificada. Corre después
 * de la autenticación y de los roles.
 */
@Injectable()
export class ConsentimientoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly consentimiento: ConsentimientoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requiere = this.reflector.getAllAndOverride<boolean>(CLAVE, [
      contexto.getHandler(),
      contexto.getClass(),
    ])
    if (!requiere) return true
    const peticion = contexto.switchToHttp().getRequest<
      PeticionAutenticada & {
        params?: Record<string, string>
        body?: { clienteId?: unknown }
      }
    >()
    const usuario = peticion.usuario
    const deCuerpo = typeof peticion.body?.clienteId === "string" ? peticion.body.clienteId : null
    const clienteId =
      peticion.params?.clienteId ?? deCuerpo ?? (usuario?.rol === "cliente" ? usuario.sub : null)
    // Sin cliente identificable no es una escritura sobre datos de salud de nadie.
    if (!clienteId) return true
    if (await this.consentimiento.vigente(clienteId)) return true
    throw new ConflictException({
      statusCode: 409,
      codigo: "consentimiento_pendiente",
      message:
        usuario?.sub === clienteId
          ? "Antes de guardar datos de salud necesitamos tu consentimiento."
          : "Este cliente aún no ha dado su consentimiento para tratar sus datos de salud.",
    })
  }
}
