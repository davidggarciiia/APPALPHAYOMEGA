import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { Credenciales, Sesion } from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

import { verificarContrasena } from "./contrasenas.js"
import { LimitadorDeIntentos } from "./limitador-intentos.service.js"
import type { ContenidoDelToken } from "./peticion.js"
import { aPublico } from "./usuarios.service.js"
import { TokensRefrescoService, type SesionEmitida } from "./tokens-refresco.service.js"

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
    private readonly limitador: LimitadorDeIntentos,
  ) {}

  /**
   * Comprueba unas credenciales y abre una sesion.
   *
   * Los tres motivos de rechazo, correo desconocido, contrasena incorrecta y
   * cuenta no activa, producen exactamente la misma respuesta. Distinguirlos
   * seria comodo para quien se equivoca y regalaria a un atacante la lista de
   * clientes del entrenador.
   */
  async iniciarSesion(credenciales: Credenciales, origen: string): Promise<Sesion> {
    const clave = `${credenciales.email}|${origen}`
    this.limitador.comprobar(clave)

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
      this.limitador.registrarFallo(clave)
      throw new UnauthorizedException("Credenciales incorrectas")
    }

    this.limitador.registrarExito(clave)

    return this.componerSesion(usuario, await this.refrescos.emitir(usuario.id))
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
    const { usuarioId, nuevo } = await this.refrescos.canjear(tokenRefresco)

    const usuario = await this.prisma.usuario.findUnique({ where: { id: usuarioId } })

    if (usuario === null || usuario.estado !== "activo") {
      // La cuenta ya no vale: se corta la cadena entera para que el token recien
      // creado en el canje no quede vivo y huerfano.
      await this.refrescos.revocarTodosDe(usuarioId)
      throw new UnauthorizedException("Sesion no valida")
    }

    return this.componerSesion(usuario, nuevo)
  }

  /** Cierra la sesion en el servidor. Borrar el token del movil no basta. */
  async cerrarSesion(tokenRefresco: string): Promise<void> {
    await this.refrescos.revocar(tokenRefresco)
  }

  private async componerSesion(
    usuario: Parameters<typeof aPublico>[0],
    refresco: SesionEmitida,
  ): Promise<Sesion> {
    // El token de acceso lleva el id de la sesion. Sin el, el guard no tendria
    // forma de saber si esta sesion se cerro o se revoco desde que se firmo.
    const contenido: ContenidoDelToken = {
      sub: usuario.id,
      rol: usuario.rol,
      sid: refresco.id,
    }

    return {
      tokenAcceso: await this.jwt.signAsync(contenido),
      tokenRefresco: refresco.token,
      usuario: aPublico(usuario),
    }
  }
}
