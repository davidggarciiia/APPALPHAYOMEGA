import { Module } from "@nestjs/common"
import { EntrenamientoController } from "./entrenamiento.controller.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"
import { RegistrosService } from "./registros.service.js"
import { AgendaModule } from "../agenda/agenda.module.js"
import { AjustesService } from "./ajustes.service.js"
import { RutinasController } from "./rutinas.controller.js"
import { RutinasService } from "./rutinas.service.js"
import { MolestiasController } from "./molestias.controller.js"
import { MolestiasService } from "./molestias.service.js"
import { ComentariosService } from "./comentarios.service.js"

@Module({
  imports: [AgendaModule],
  controllers: [EntrenamientoController, RutinasController, MolestiasController],
  providers: [
    PlanesService,
    SesionesService,
    RegistrosService,
    AjustesService,
    RutinasService,
    MolestiasService,
    ComentariosService,
  ],
})
export class EntrenamientoModule {}
