import { Injectable, NotImplementedException } from "@nestjs/common"
import type { ConsultarEvolucion, Evolucion } from "@alpha-omega/shared"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Evolución: publicaciones vigentes e histórico en series comparables (E01a). */
@Injectable()
export class EvolucionValoracionesService {
  constructor(private readonly prisma: PrismaService) {}

  evolucion(
    _actor: IdentidadVerificada,
    _clienteId: string,
    _consulta: ConsultarEvolucion,
  ): Promise<Evolucion> {
    void this.prisma
    throw new NotImplementedException()
  }
}
