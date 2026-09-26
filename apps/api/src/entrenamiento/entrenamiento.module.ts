import { Module } from "@nestjs/common"

import { AgendaModule } from "../agenda/agenda.module.js"

import { BorradoresService } from "./borradores.service.js"
import { EntrenamientoController } from "./entrenamiento.controller.js"
import { EnviosService } from "./envios.service.js"
import { PlanesService } from "./planes.service.js"
import { PrescripcionesService } from "./prescripciones.service.js"
import { RutinasController } from "./rutinas.controller.js"
import { RutinasService } from "./rutinas.service.js"
import { SesionesService } from "./sesiones.service.js"

@Module({
  imports: [AgendaModule],
  controllers: [EntrenamientoController, RutinasController],
  providers: [
    SesionesService,
    PlanesService,
    BorradoresService,
    EnviosService,
    PrescripcionesService,
    RutinasService,
  ],
})
export class EntrenamientoModule {}
