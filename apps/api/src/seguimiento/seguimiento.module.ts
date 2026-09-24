import { Module } from "@nestjs/common"

import { EvolucionValoracionesController } from "./evolucion-valoraciones.controller.js"
import { EvolucionValoracionesService } from "./evolucion-valoraciones.service.js"
import { PlantillasValoracionService } from "./plantillas-valoracion.service.js"
import { SeguimientoController } from "./seguimiento.controller.js"
import { SeguimientoService } from "./seguimiento.service.js"
import { SolicitudesFotosController } from "./solicitudes-fotos.controller.js"
import { SolicitudesFotosService } from "./solicitudes-fotos.service.js"
import { ValoracionesController } from "./valoraciones.controller.js"
import { ValoracionesNovedadesController } from "./valoraciones-novedades.controller.js"
import { ValoracionesNovedadesService } from "./valoraciones-novedades.service.js"
import { ValoracionesService } from "./valoraciones.service.js"

/**
 * Módulo `seguimiento`: registro diario, medidas corporales, pruebas físicas y
 * valoraciones profesionales (visitas, borradores y publicaciones) y solicitudes
 * de fotos al cliente.
 */
@Module({
  controllers: [
    SeguimientoController,
    ValoracionesController,
    SolicitudesFotosController,
    EvolucionValoracionesController,
    ValoracionesNovedadesController,
  ],
  providers: [
    SeguimientoService,
    PlantillasValoracionService,
    ValoracionesService,
    SolicitudesFotosService,
    EvolucionValoracionesService,
    ValoracionesNovedadesService,
  ],
})
export class SeguimientoModule {}
