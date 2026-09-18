import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common"

import { ServicioDeCorreo } from "../correo/correo.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { LimitadorDeIntentos } from "./limitador-intentos.service.js"
import { cifrarContrasena } from "./contrasenas.js"
import { TokensRefrescoService } from "./tokens-refresco.service.js"

const VALIDEZ_MS = 60 * 60 * 1000

@Injectable()
export class RecuperacionService {
  private readonly registro = new Logger(RecuperacionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: ServicioDeCorreo,
    private readonly limitador: LimitadorDeIntentos,
    private readonly refrescos: TokensRefrescoService,
  ) {}

  /** La respuesta no distingue cuenta ausente, no activa, limite o fallo de correo. */
  async solicitar(email: string, origen: string): Promise<void> {
    // La clave del correo lleva tambien el origen. Sin el, ese contador es de la
    // victima y lo sube cualquiera desde cualquier sitio: cinco peticiones
    // anonimas dejaban a una persona sin poder recuperar su cuenta, y como el
    // limitador dobla la espera a cada fallo, el bloqueo llegaba a los quince
    // minutos y se renovaba con otra peticion. Denegar el servicio a alguien
    // concreto no puede costar cinco peticiones.
    const claves = [`recuperar:ip:${origen}`, `recuperar:correo:${hashDe(email)}|${origen}`]
    try {
      claves.forEach((clave) => this.limitador.comprobar(clave))
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        return
      }
      throw error
    }
    claves.forEach((clave) => this.limitador.registrarFallo(clave))

    const usuario = await this.prisma.usuario.findUnique({ where: { email } })
    if (usuario === null || usuario.estado !== "activo") return

    const secreto = randomBytes(32).toString("base64url")
    const fila = await this.prisma.$transaction(async (tx) => {
      // Mismo orden que baja, activacion y refresco: usuario -> tokens.
      // Serializa dos solicitudes y evita emitir tras una baja simultanea.
      const bloqueado = await tx.usuario.updateMany({
        where: { id: usuario.id, email, estado: "activo" },
        data: { actualizadoEn: new Date() },
      })
      if (bloqueado.count !== 1) return null

      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId: usuario.id, usadoEn: null },
        data: { usadoEn: new Date() },
      })
      return tx.tokenRecuperacion.create({
        data: {
          usuarioId: usuario.id,
          hash: hashDe(secreto),
          expiraEn: new Date(Date.now() + VALIDEZ_MS),
        },
      })
    })
    if (fila === null) return

    const enlace = `alphaomega://restablecer?token=${encodeURIComponent(`${fila.id}.${secreto}`)}`

    // El envio NO se espera dentro de la peticion, y no es por velocidad.
    //
    // Esta ruta contesta 204 exista o no la cuenta, que es lo correcto, pero si
    // esperase al proveedor de correo el reloj delataria lo que el cuerpo calla:
    // un correo desconocido responde en milisegundos y uno real tarda lo que
    // tarde Resend. Con cien peticiones y un cronometro, cualquiera separa los
    // clientes del entrenador del resto. Soltando el envio, las dos ramas salen
    // igual de rapido.
    void this.enviarEnlace(email, enlace)
  }

  private async enviarEnlace(email: string, enlace: string): Promise<void> {
    try {
      await this.correo.enviar({
        para: email,
        asunto: "Restablece tu contraseña de Alpha & Omega Training",
        texto: `Has solicitado cambiar tu contraseña de Alpha & Omega Training.\n\n${enlace}\n\nEl enlace caduca en 1 hora y solo sirve una vez. Si no lo has solicitado, ignora este correo.`,
        html: `<div style="font-family:system-ui,sans-serif;background:#0A0A0A;color:#F5F5F0;padding:32px"><p style="color:#C9A227;letter-spacing:4px;font-weight:700">ALPHA &amp; OMEGA</p><p>Has solicitado cambiar tu contrase&ntilde;a.</p><p><a href="${enlace}" style="color:#C9A227">RESTABLECER MI CONTRASE&Ntilde;A</a></p><p>El enlace caduca en 1 hora y solo sirve una vez. Si no lo has solicitado, ignora este correo.</p></div>`,
      })
    } catch {
      // No se devuelve el error del proveedor ni se escribe el token en logs.
      this.registro.warn("No se ha podido enviar un correo de recuperacion")
    }
  }

  async restablecer(token: string, contrasena: string, origen: string): Promise<void> {
    const clave = `restablecer:ip:${origen}`
    this.limitador.comprobar(clave)
    this.limitador.registrarFallo(clave)

    const [id = "", secreto = "", sobrante] = token.split(".")
    if (id === "" || secreto === "" || sobrante !== undefined) throw enlaceInvalido()
    const fila = await this.prisma.tokenRecuperacion.findUnique({ where: { id } })
    if (
      fila === null ||
      fila.usadoEn !== null ||
      fila.expiraEn.getTime() <= Date.now() ||
      !coincideElHash(fila.hash, secreto)
    )
      throw enlaceInvalido()

    const passwordHash = await cifrarContrasena(contrasena)
    await this.prisma.$transaction(async (tx) => {
      const bloqueado = await tx.usuario.updateMany({
        where: { id: fila.usuarioId, estado: "activo" },
        data: { actualizadoEn: new Date() },
      })
      if (bloqueado.count !== 1) throw enlaceInvalido()

      // Se vuelve a comprobar caducidad y uso despues de Argon2 y del bloqueo.
      // Solo una peticion puede consumirlo; cualquier fallo revierte todo.
      const consumido = await tx.tokenRecuperacion.updateMany({
        where: { id: fila.id, usadoEn: null, expiraEn: { gt: new Date() } },
        data: { usadoEn: new Date() },
      })
      if (consumido.count !== 1) throw enlaceInvalido()

      await tx.usuario.update({ where: { id: fila.usuarioId }, data: { passwordHash } })
      await tx.tokenRecuperacion.updateMany({
        where: { usuarioId: fila.usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      })
      await this.refrescos.revocarTodosDe(fila.usuarioId, tx)
    })
  }
}

function hashDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex")
}

function coincideElHash(guardado: string, secreto: string): boolean {
  const esperado = Buffer.from(guardado, "hex")
  const calculado = Buffer.from(hashDe(secreto), "hex")
  return esperado.length === calculado.length && timingSafeEqual(esperado, calculado)
}

function enlaceInvalido(): BadRequestException {
  return new BadRequestException("Este enlace ya no es valido")
}
