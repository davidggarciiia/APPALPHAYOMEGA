import { Module } from "@nestjs/common"
import { EntrenamientoController } from "./entrenamiento.controller.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"
import { RegistrosService } from "./registros.service.js"
import { AgendaModule } from "../agenda/agenda.module.js"
import { AjustesService } from "./ajustes.service.js"
import { RutinasController } from "./rutinas.controller.js"
import { RutinasService } from "./rutinas.service.js"

@Module({
  imports: [AgendaModule],
  controllers: [EntrenamientoController, RutinasController],
  providers: [PlanesService, SesionesService, RegistrosService, AjustesService, RutinasService],
})
export class EntrenamientoModule {}
