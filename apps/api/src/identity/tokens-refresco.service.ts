import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { Injectable, UnauthorizedException } from "@nestjs/common"

import { leerVariableOpcional } from "../config/entorno.js"
import { PrismaService } from "../prisma/prisma.service.js"

const DIAS_POR_DEFECTO = 30
const BYTES_DE_SECRETO = 32

/**
 * Emision, canje y revocacion de tokens de refresco.
 *
 * El token que ve el cliente tiene la forma `<id>.<secreto>`. El id permite
 * localizar la fila sin recorrer la tabla; el secreto es lo que se comprueba.
 * En la base solo vive el hash del secreto, asi que una copia robada de la base
 * de datos no contiene ninguna sesion utilizable.
 */
@Injectable()
export class TokensRefrescoService {
  constructor(private readonly prisma: PrismaService) {}

  async emitir(usuarioId: string): Promise<string> {
    const secreto = randomBytes(BYTES_DE_SECRETO).toString("base64url")

    const fila = await this.prisma.tokenRefresco.create({
      data: {
        usuarioId,
        hash: hashDe(secreto),
        expiraEn: new Date(Date.now() + this.duracionEnMilisegundos()),
      },
    })

    return `${fila.id}.${secreto}`
  }

  /**
   * Canjea un token por otro y devuelve a quien pertenece.
   *
   * El token usado se revoca en el mismo paso. Esa rotacion es lo que convierte
   * un robo en algo detectable: si alguien copia un token y lo usa, el duenno
   * legitimo se encuentra el suyo invalidado la proxima vez.
   */
  async canjear(token: string): Promise<{ usuarioId: string; nuevoToken: string }> {
    const fila = await this.buscarValido(token)

    await this.prisma.tokenRefresco.update({
      where: { id: fila.id },
      data: { revocadoEn: new Date() },
    })

    return {
      usuarioId: fila.usuarioId,
      nuevoToken: await this.emitir(fila.usuarioId),
    }
  }

  /** Cierra la sesion revocando el token. Borrarlo del movil no basta. */
  async revocar(token: string): Promise<void> {
    const fila = await this.buscarValido(token)

    await this.prisma.tokenRefresco.update({
      where: { id: fila.id },
      data: { revocadoEn: new Date() },
    })
  }

  /** Revoca todas las sesiones de un usuario. Se usa al cambiar la contrasena. */
  async revocarTodosDe(usuarioId: string): Promise<void> {
    await this.prisma.tokenRefresco.updateMany({
      where: { usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    })
  }

  private async buscarValido(token: string): Promise<{ id: string; usuarioId: string }> {
    const separador = token.indexOf(".")
    if (separador === -1) {
      throw new UnauthorizedException("Sesion no valida")
    }

    const id = token.slice(0, separador)
    const secreto = token.slice(separador + 1)

    const fila = await this.prisma.tokenRefresco.findUnique({ where: { id } })

    // Un token inexistente, uno ya revocado, uno caducado y uno con el secreto
    // equivocado dan el mismo error. Distinguirlos diria a un atacante si un
    // identificador existe.
    if (
      fila === null ||
      fila.revocadoEn !== null ||
      fila.expiraEn.getTime() <= Date.now() ||
      !coincideElHash(fila.hash, secreto)
    ) {
      throw new UnauthorizedException("Sesion no valida")
    }

    return { id: fila.id, usuarioId: fila.usuarioId }
  }

  private duracionEnMilisegundos(): number {
    const dias = Number(leerVariableOpcional("REFRESCO_DIAS", String(DIAS_POR_DEFECTO)))
    return dias * 24 * 60 * 60 * 1000
  }
}

function hashDe(secreto: string): string {
  return createHash("sha256").update(secreto).digest("hex")
}

/**
 * Comparacion en tiempo constante.
 *
 * Un `===` corriente corta en cuanto encuentra el primer caracter distinto, y
 * esa diferencia de tiempo es medible: permite ir adivinando el hash caracter a
 * caracter. Aqui el riesgo es pequeno porque el secreto es aleatorio, pero la
 * version correcta cuesta lo mismo de escribir.
 */
function coincideElHash(guardado: string, secreto: string): boolean {
  const calculado = Buffer.from(hashDe(secreto), "hex")
  const esperado = Buffer.from(guardado, "hex")

  if (calculado.length !== esperado.length) {
    return false
  }

  return timingSafeEqual(calculado, esperado)
}
