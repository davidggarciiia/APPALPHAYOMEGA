import { Module } from "@nestjs/common"

import { BajasPlanes } from "./bajas-planes.js"
import { CobrosService } from "./cobros.service.js"
import { PlanesController } from "./planes.controller.js"
import { PlanesService } from "./planes.service.js"
import { SaldoService } from "./saldo.service.js"

/**
 * Productos, saldo, solicitudes y cobros (SPEC-planes.md). Exporta el saldo y los
 * cobros para que `agenda` gaste y cobre dentro de su transacción. Nunca importa
 * `agenda`: cada movimiento guarda su origen como tipo + id.
 */
@Module({
  controllers: [PlanesController],
  providers: [PlanesService, SaldoService, CobrosService, BajasPlanes],
  exports: [SaldoService, CobrosService],
})
export class PlanesModule {}
