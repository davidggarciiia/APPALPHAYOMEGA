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

  /** Aceptar dos veces la misma versión no crea otra fila ni cambia la fecha. */
  async aceptar(usuarioId: string, datos: AceptarConsentimiento): Promise<EstadoConsentimiento> {
    await this.prisma.consentimientoSalud.upsert({
      where: { usuarioId_version: { usuarioId, version: datos.version } },
      create: { usuarioId, version: datos.version },
      update: {},
    })
    return this.estado(usuarioId)
  }
}
