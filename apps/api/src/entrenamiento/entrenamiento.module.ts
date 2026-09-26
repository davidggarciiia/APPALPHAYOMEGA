import { Module } from "@nestjs/common"

import { AgendaModule } from "../agenda/agenda.module.js"

import { EntrenamientoController } from "./entrenamiento.controller.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"

@Module({
  imports: [AgendaModule],
  controllers: [EntrenamientoController],
  providers: [SesionesService, PlanesService],
})
export class EntrenamientoModule {}
