import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { JwtService } from "@nestjs/jwt"

import { PrismaService } from "../prisma/prisma.service.js"

import { ContenidoDelTokenSchema, type PeticionAutenticada } from "./peticion.js"
import { CLAVE_PUBLICO } from "./publico.decorator.js"
import { TokensRefrescoService } from "./tokens-refresco.service.js"

/**
 * Guard global: ninguna ruta responde sin una sesion valida, salvo las marcadas
 * con `@Publico()`.
 *
 * Se registra como APP_GUARD, asi que cubre tambien los controladores que aun no
 * existen. Ese es el punto: un endpoint escrito con prisa dentro de seis meses
 * nace cerrado sin que nadie se acuerde de protegerlo.
 *
 * Comprobar la firma del token NO basta, y esa fue la version anterior de este
 * fichero. Un token firmado es un papel que nadie puede retirar: seguia
 * abriendo puertas despues de cerrar sesion, despues de desactivar la cuenta y
 * despues de borrarla, hasta que caducaba solo. En una app con los datos de
 * salud de personas reales y un profesional externo entre los usuarios, eso no
 * se sostiene. Por eso aqui se contrasta contra la base en cada peticion.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly refrescos: TokensRefrescoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ])

    if (esPublica === true) {
      return true
    }

    const peticion = contexto.switchToHttp().getRequest<PeticionAutenticada>()
    const token = extraerToken(peticion)

    if (token === null) {
      throw new UnauthorizedException("Falta la sesion")
    }

    let contenidoSinValidar: unknown
    try {
      contenidoSinValidar = await this.jwt.verifyAsync(token)
    } catch {
      // Firma invalida, token caducado o manipulado. Los tres casos dicen lo
      // mismo hacia fuera: no distinguirlos evita dar pistas a quien prueba.
      throw new UnauthorizedException("Sesion no valida")
    }

    const contenido = ContenidoDelTokenSchema.safeParse(contenidoSinValidar)
    if (!contenido.success) {
      throw new UnauthorizedException("Sesion no valida")
    }

    // La sesion pudo cerrarse o revocarse despues de firmar este token.
    if (!(await this.refrescos.sesionSigueViva(contenido.data.sid))) {
      throw new UnauthorizedException("Sesion no valida")
    }

    // Y la cuenta pudo desactivarse, borrarse o cambiar de rol. El rol que vale
    // es el de la base, no el que el token lleve congelado desde hace rato.
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: contenido.data.sub },
      select: { rol: true, estado: true },
    })

    if (usuario === null || usuario.estado !== "activo") {
      throw new UnauthorizedException("Sesion no valida")
    }

    peticion.usuario = {
      sub: contenido.data.sub,
      rol: usuario.rol,
      sid: contenido.data.sid,
    }

    return true
  }
}

/**
 * Lee el token de la cabecera Authorization con el esquema Bearer.
 *
 * Solo se acepta ahi. Admitirlo tambien por parametro de URL seria comodo y
 * dejaria sesiones escritas en los logs del servidor y en el historial de
 * cualquier intermediario.
 */
function extraerToken(peticion: PeticionAutenticada): string | null {
  const cabecera = peticion.headers.authorization

  if (typeof cabecera !== "string") {
    return null
  }

  const [esquema, valor] = cabecera.split(" ")
  if (esquema !== "Bearer" || valor === undefined || valor === "") {
    return null
  }

  return valor
}
