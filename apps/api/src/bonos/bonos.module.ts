import { Module } from "@nestjs/common"
import { BonosController } from "./bonos.controller.js"
import { BonosService } from "./bonos.service.js"

@Module({ controllers: [BonosController], providers: [BonosService], exports: [BonosService] })
export class BonosModule {}
