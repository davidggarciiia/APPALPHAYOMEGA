import { Injectable, NotImplementedException } from "@nestjs/common"
import type { ListadoAvisosSeguimiento } from "@alpha-omega/shared"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

/** Avisos de valoraciones y solicitudes de fotos con lectura por usuario (E02a). */
@Injectable()
export class ValoracionesNovedadesService {
  constructor(private readonly prisma: PrismaService) {}

  avisos(_actor: IdentidadVerificada, _clienteId: string): Promise<ListadoAvisosSeguimiento> {
    void this.prisma
    throw new NotImplementedException()
  }
}
