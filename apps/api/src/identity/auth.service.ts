import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { Credenciales, Sesion } from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

import { verificarContrasena } from "./contrasenas.js"
import type { ContenidoDelToken } from "./peticion.js"
import { TokensRefrescoService } from "./tokens-refresco.service.js"

/**
 * Hash de descarte con el formato correcto de Argon2id.
 *
 * Cuando el correo no existe se verifica igualmente contra este hash. Sin eso,
 * el servidor contestaria mucho mas rapido a un correo desconocido que a uno
 * registrado con la contrasena mal, y esa diferencia de tiempo permite averiguar
 * quien tiene cuenta sin necesitar ni una sola contrasena acertada.
 */
const HASH_SENUELO =
  "$argon2id$v=19$m=19456,t=2,p=1$LY2ttgePXzuNaAMRea2jcQ$CtwkHO+tCBGQS+FjrtoUzDm6AULWPkd0lUnZrRIuxAE"

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refrescos: TokensRefrescoService,
  ) {}

  /**
   * Comprueba unas credenciales y abre una sesion.
   *
   * Los tres motivos de rechazo, correo desconocido, contrasena incorrecta y
   * cuenta no activa, producen exactamente la misma respuesta. Distinguirlos
   * seria comodo para quien se equivoca y regalaria a un atacante la lista de
   * clientes del entrenador.
   */
  async iniciarSesion(credenciales: Credenciales): Promise<Sesion> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: credenciales.email },
    })

    const coincide = await verificarContrasena(
      usuario?.passwordHash ?? HASH_SENUELO,
      credenciales.contrasena,
    )

    // Un usuario en estado pendiente existe y todavia no tiene contrasena
    // (requisito 2). Uno desactivado conserva la suya y aun asi no entra.
    if (usuario === null || !coincide || usuario.estado !== "activo") {
      throw new UnauthorizedException("Credenciales incorrectas")
    }

    return {
      tokenAcceso: await this.firmarAcceso({ sub: usuario.id, rol: usuario.rol }),
      tokenRefresco: await this.refrescos.emitir(usuario.id),
      usuario: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
      },
    }
  }

  /**
   * Cambia un token de refresco por una sesion nueva.
   *
   * Se vuelve a leer el usuario de la base en lugar de confiar en lo que hubiera
   * dentro del token antiguo: entre la emision y el canje pueden haber pasado
   * semanas, y el rol o el estado pueden haber cambiado. Un cliente desactivado
   * ayer no debe seguir renovando su sesion hoy.
   */
  async refrescar(tokenRefresco: string): Promise<Sesion> {
    const { usuarioId, nuevoToken } = await this.refrescos.canjear(tokenRefresco)

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } })

    if (usuario === null || usuario.estado !== "activo") {
      throw new UnauthorizedException("Sesion no valida")
    }

    return {
      tokenAcceso: await this.firmarAcceso({ sub: usuario.id, rol: usuario.rol }),
      tokenRefresco: nuevoToken,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
      },
    }
  }

  /** Cierra la sesion en el servidor. Borrar el token del movil no basta. */
  async cerrarSesion(tokenRefresco: string): Promise<void> {
    await this.refrescos.revocar(tokenRefresco)
  }

  private async firmarAcceso(contenido: ContenidoDelToken): Promise<string> {
    return this.jwt.signAsync(contenido)
  }
}
