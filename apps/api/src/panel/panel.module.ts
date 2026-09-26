import { Module } from "@nestjs/common"

import { PanelController } from "./panel.controller.js"
import { PanelService } from "./panel.service.js"

/** Módulo `panel`: el resumen «Hoy» del entrenador. Solo lee tablas de otros módulos. */
@Module({ controllers: [PanelController], providers: [PanelService] })
export class PanelModule {}
