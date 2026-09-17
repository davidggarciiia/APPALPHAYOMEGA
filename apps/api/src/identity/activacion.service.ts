import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { BadRequestException, Injectable, Logger } from "@nestjs/common"

import { leerVariableOpcional } from "../config/entorno.js"
import { ServicioDeCorreo } from "../correo/correo.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { cifrarContrasena } from "./contrasenas.js"

const DIAS_DE_VALIDEZ = 7
const BYTES_DE_SECRETO = 32

/**
 * Enlaces de activacion: el puente entre un perfil que existe y una persona que
 * puede entrar.
 *
 * El entrenador crea el perfil y este servicio manda el enlace con el que su
 * titular fija la contrasena. Mismo patron que el token de refresco: en la base
 * solo vive el hash, y lo que viaja por correo es `<id>.<secreto>`.
 *
 * Caduca a los siete dias y solo sirve una vez, porque un correo se queda en
 * servidores ajenos y en la papelera durante anos.
 */
@Injectable()
export class ActivacionService {
  private readonly registro = new Logger(ActivacionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: ServicioDeCorreo,
  ) {}

  /**
   * Crea un enlace y lo envia.
   *
   * Los enlaces anteriores del mismo usuario se invalidan: si el entrenador
   * reenvia la invitacion, el correo viejo deja de valer. Tener dos enlaces
   * vivos para la misma cuenta multiplica sin motivo las copias que hay sueltas
   * por ahi.
   */
  async enviarEnlace(usuarioId: string): Promise<void> {
    const secreto = randomBytes(BYTES_DE_SECRETO).toString("base64url")
    const { usuario, fila } = await this.prisma.$transaction(async (tx) => {
      // Mismo orden de bloqueo que activar, corregir correo y dar de baja:
      // primero el usuario, despues sus enlaces. Ningun reenvio puede dejar un
      // enlace vivo emitido entre la comprobacion de estado y la baja.
      const pendiente = await tx.usuario.updateMany({
        where: { id: usuarioId, estado: "pendiente" },
        data: { actualizadoEn: new Date() },
      })
      if (pendiente.count !== 1) {
        throw new BadRequestException("Este perfil no esta pendiente de activacion")
      }
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } })
      await tx.tokenActivacion.updateMany({
        where: { usuarioId, usadoEn: null },
        data: { usadoEn: new Date() },
      })
      const fila = await tx.tokenActivacion.create({
        data: {
          usuarioId,
          hash: hashDe(secreto),
          expiraEn: new Date(Date.now() + DIAS_DE_VALIDEZ * 24 * 60 * 60 * 1000),
        },
      })
      return { usuario, fila }
    })

    const enlace = this.componerEnlace(`${fila.id}.${secreto}`)
    await this.correo.enviar(mensajeDeActivacion(usuario.email, usuario.nombre, enlace))

    this.registro.log(`Enlace de activacion enviado para el usuario ${usuarioId}`)
  }

  /**
   * Canjea el enlace por una contrasena y activa la cuenta.
   *
   * Las tres escrituras van en una transaccion. Sin ella, un fallo a mitad
   * dejaria la contrasena puesta con la cuenta todavia pendiente, o el token
   * gastado sin contrasena: en los dos casos alguien se queda fuera de su propia
   * cuenta con el unico enlace que tenia ya consumido.
   */
  async activar(token: string, contrasena: string): Promise<void> {
    const fila = await this.buscarValido(token)
    const passwordHash = await cifrarContrasena(contrasena)

    await this.prisma.$transaction(async (tx) => {
      // El usuario va primero para serializar el canje con baja y correccion
      // de correo. Si el enlace falla despues, la transaccion deshace el cambio.
      const activado = await tx.usuario.updateMany({
        where: { id: fila.usuarioId, estado: "pendiente" },
        data: { passwordHash, estado: "activo" },
      })
      if (activado.count !== 1) {
        throw new BadRequestException("Este enlace ya no es valido")
      }

      const { count } = await tx.tokenActivacion.updateMany({
        where: { id: fila.id, usadoEn: null, expiraEn: { gt: new Date() } },
        data: { usadoEn: new Date() },
      })

      // Escritura condicional: si dos peticiones llegan a la vez con el mismo
      // enlace, la base arbitra y solo una lo consume.
      if (count !== 1) {
        throw new BadRequestException("Este enlace ya no es valido")
      }
    })

    this.registro.log(`Cuenta activada: usuario ${fila.usuarioId}`)
  }

  private async buscarValido(token: string): Promise<{ id: string; usuarioId: string }> {
    const separador = token.indexOf(".")
    if (separador === -1) {
      throw new BadRequestException("Este enlace ya no es valido")
    }

    const id = token.slice(0, separador)
    const secreto = token.slice(separador + 1)

    const fila = await this.prisma.tokenActivacion.findUnique({ where: { id } })

    // Inexistente, usado, caducado o con el secreto equivocado dan el mismo
    // error. Distinguirlos diria a un atacante si un identificador existe.
    if (
      fila === null ||
      fila.usadoEn !== null ||
      fila.expiraEn.getTime() <= Date.now() ||
      !coincideElHash(fila.hash, secreto)
    ) {
      throw new BadRequestException("Este enlace ya no es valido")
    }

    return { id: fila.id, usuarioId: fila.usuarioId }
  }

  /**
   * El enlace apunta a la app por su esquema propio.
   *
   * En un movil con la app instalada, tocarlo la abre en la pantalla de
   * activacion. Configurable porque el dia que exista una pagina web de
   * activacion cambiara sin tocar codigo.
   */
  private componerEnlace(token: string): string {
    const base = leerVariableOpcional("ACTIVACION_URL_BASE", "alphaomega://activar")
    return `${base}?token=${encodeURIComponent(token)}`
  }
}

function mensajeDeActivacion(
  para: string,
  nombre: string,
  enlace: string,
): { para: string; asunto: string; html: string; texto: string } {
  return {
    para,
    asunto: "Activa tu cuenta de Alpha & Omega Training",
    html: `<div style="font-family:system-ui,sans-serif;background:#0A0A0A;color:#F5F5F0;padding:32px">
  <p style="color:#C9A227;letter-spacing:4px;font-weight:700;margin:0">ALPHA &amp; OMEGA</p>
  <p style="color:#8A8A85;letter-spacing:8px;font-size:11px;margin:4px 0 24px">TRAINING</p>
  <p>Hola ${escapar(nombre)},</p>
  <p>Tu entrenador te ha creado una cuenta. Elige tu contrase&ntilde;a para empezar:</p>
  <p style="margin:24px 0"><a href="${enlace}" style="background:#C9A227;color:#0A0A0A;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;letter-spacing:2px">ACTIVAR MI CUENTA</a></p>
  <p style="color:#8A8A85;font-size:13px">El enlace caduca en 7 d&iacute;as y solo sirve una vez. Si no esperabas este correo, ign&oacute;ralo.</p>
</div>`,
    texto: `Hola ${nombre},\n\nTu entrenador te ha creado una cuenta en Alpha & Omega Training. Elige tu contrasena aqui:\n\n${enlace}\n\nEl enlace caduca en 7 dias y solo sirve una vez. Si no esperabas este correo, ignoralo.`,
  }
}

/**
 * El nombre lo escribe el entrenador, asi que es texto de fuera y no puede
 * incrustarse en HTML tal cual: unas comillas bien puestas cambiarian la
 * estructura del correo.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function hashDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex")
}

function coincideElHash(guardado: string, secreto: string): boolean {
  const calculado = Buffer.from(hashDe(secreto), "hex")
  const esperado = Buffer.from(guardado, "hex")

  if (calculado.length !== esperado.length) {
    return false
  }

  return timingSafeEqual(calculado, esperado)
}
