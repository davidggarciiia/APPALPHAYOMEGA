import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { Credenciales, Rol, Sesion } from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

import { verificarContrasena } from "./contrasenas.js"

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

export type ContenidoDelToken = {
  sub: string
  rol: Rol
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Comprueba unas credenciales y devuelve una sesion.
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

    const contenido: ContenidoDelToken = { sub: usuario.id, rol: usuario.rol }

    return {
      tokenAcceso: await this.jwt.signAsync(contenido),
      usuario: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol,
      },
    }
  }
}
