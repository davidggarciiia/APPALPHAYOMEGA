import { Module } from "@nestjs/common"

import { SeguimientoController } from "./seguimiento.controller.js"
import { SeguimientoService } from "./seguimiento.service.js"

/** Módulo `seguimiento`: registro diario, medidas corporales y pruebas físicas. */
@Module({
  controllers: [SeguimientoController],
  providers: [SeguimientoService],
})
export class SeguimientoModule {}
