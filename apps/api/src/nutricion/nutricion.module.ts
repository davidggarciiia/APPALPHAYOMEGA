import { Module } from "@nestjs/common"

import { NutricionController } from "./nutricion.controller.js"
import { ComidasService } from "./comidas.service.js"
import { DietasService } from "./dietas.service.js"

/** Módulo `nutricion` del mapa de capacidades: dietas por cliente. */
@Module({
  controllers: [NutricionController],
  providers: [DietasService, ComidasService],
})
export class NutricionModule {}
