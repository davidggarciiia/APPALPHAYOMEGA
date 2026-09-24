import { Module } from "@nestjs/common"

import { PlantillasValoracionService } from "./plantillas-valoracion.service.js"
import { SeguimientoController } from "./seguimiento.controller.js"
import { SeguimientoService } from "./seguimiento.service.js"
import { ValoracionesController } from "./valoraciones.controller.js"
import { ValoracionesService } from "./valoraciones.service.js"

/**
 * Módulo `seguimiento`: registro diario, medidas corporales, pruebas físicas y
 * valoraciones profesionales (visitas, borradores y publicaciones).
 */
@Module({
  controllers: [SeguimientoController, ValoracionesController],
  providers: [SeguimientoService, PlantillasValoracionService, ValoracionesService],
})
export class SeguimientoModule {}
