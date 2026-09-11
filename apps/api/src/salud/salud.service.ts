import { Injectable } from "@nestjs/common"

import { PrismaService } from "../prisma/prisma.service.js"

export type EstadoSalud = {
  estado: "ok" | "degradado"
  baseDeDatos: "ok" | "sin respuesta"
}

@Injectable()
export class SaludService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprueba que la base de datos responde de verdad, no solo que el proceso
   * esta vivo. Un endpoint de salud que solo dice "estoy arrancado" no sirve
   * para nada: el caso que hay que detectar es justamente el servidor en pie con
   * la base caida.
   */
  async comprobar(): Promise<EstadoSalud> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return { estado: "ok", baseDeDatos: "ok" }
    } catch {
      return { estado: "degradado", baseDeDatos: "sin respuesta" }
    }
  }
}
