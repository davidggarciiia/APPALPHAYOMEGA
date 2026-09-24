import { Injectable } from "@nestjs/common"
import {
  VERSION_CONSENTIMIENTO,
  type AceptarConsentimiento,
  type EstadoConsentimiento,
} from "@alpha-omega/shared"

import { PrismaService } from "../prisma/prisma.service.js"

/**
 * Consentimiento explícito de datos de salud (RGPD, art. 9). Vigente solo si
 * el cliente aceptó la versión actual del texto y no la ha retirado.
 */
@Injectable()
export class ConsentimientoService {
  constructor(private readonly prisma: PrismaService) {}

  async estado(usuarioId: string): Promise<EstadoConsentimiento> {
    const ultimo = await this.prisma.consentimientoSalud.findFirst({
      where: { usuarioId },
      orderBy: { aceptadoEn: "desc" },
    })
    return {
      version: ultimo?.version ?? null,
      aceptadoEn: ultimo?.aceptadoEn.toISOString() ?? null,
      retiradoEn: ultimo?.retiradoEn?.toISOString() ?? null,
      vigente: ultimo?.version === VERSION_CONSENTIMIENTO && ultimo.retiradoEn === null,
      versionVigente: VERSION_CONSENTIMIENTO,
    }
  }

  async vigente(usuarioId: string): Promise<boolean> {
    const fila = await this.prisma.consentimientoSalud.findUnique({
      where: { usuarioId_version: { usuarioId, version: VERSION_CONSENTIMIENTO } },
      select: { retiradoEn: true },
    })
    return fila !== null && fila.retiradoEn === null
  }

  /**
   * Aceptar dos veces la misma versión no crea otra fila ni cambia la fecha.
   * Volver a aceptar tras retirarlo lo reactiva con la fecha nueva.
   */
  async aceptar(usuarioId: string, datos: AceptarConsentimiento): Promise<EstadoConsentimiento> {
    const clave = { usuarioId_version: { usuarioId, version: datos.version } }
    const fila = await this.prisma.consentimientoSalud.findUnique({
      where: clave,
      select: { retiradoEn: true },
    })
    if (fila?.retiradoEn)
      await this.prisma.consentimientoSalud.update({
        where: clave,
        data: { retiradoEn: null, aceptadoEn: new Date() },
      })
    else if (!fila)
      await this.prisma.consentimientoSalud.upsert({
        where: clave,
        create: { usuarioId, version: datos.version },
        update: {},
      })
    return this.estado(usuarioId)
  }

  /**
   * Retirarlo es tan fácil como darlo (RGPD, art. 7.3). No borra lo tratado
   * antes: desde ese momento no se guarda ningún dato de salud nuevo.
   */
  async retirar(usuarioId: string): Promise<EstadoConsentimiento> {
    await this.prisma.consentimientoSalud.updateMany({
      where: { usuarioId, retiradoEn: null },
      data: { retiradoEn: new Date() },
    })
    return this.estado(usuarioId)
  }
}
