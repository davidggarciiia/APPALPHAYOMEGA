import { Injectable } from "@nestjs/common"
import type { EstadoSalud } from "@alpha-omega/shared"

import { leerEnteroPositivo } from "../config/entorno.js"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class SaludService {
  private readonly plazoMs = leerEnteroPositivo("SALUD_PLAZO_MS", 3_000)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Comprueba que la base de datos responde de verdad, no solo que el proceso
   * esta vivo. Un endpoint de salud que solo dice "estoy arrancado" no sirve
   * para nada: el caso que hay que detectar es justamente el servidor en pie con
   * la base caida.
   *
   * Con la base colgada la consulta no falla, simplemente no vuelve: sin plazo
   * propio la sonda se quedaria esperando y el balanceador no veria el 503.
   */
  async comprobar(): Promise<EstadoSalud> {
    let temporizador: NodeJS.Timeout | undefined
    const agotado = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error("plazo agotado")), this.plazoMs)
    })
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, agotado])
      return { estado: "ok", baseDeDatos: "ok" }
    } catch {
      return { estado: "degradado", baseDeDatos: "sin respuesta" }
    } finally {
      clearTimeout(temporizador)
    }
  }
}
