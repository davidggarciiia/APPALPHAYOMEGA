import { Module } from "@nestjs/common"
import { EntrenamientoController } from "./entrenamiento.controller.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"

@Module({ controllers: [EntrenamientoController], providers: [PlanesService, SesionesService] })
export class EntrenamientoModule {}
