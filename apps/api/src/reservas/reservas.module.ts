import { Module } from "@nestjs/common"
import { BonosModule } from "../bonos/bonos.module.js"
import { ReservasController } from "./reservas.controller.js"
import { ReservasService } from "./reservas.service.js"

@Module({ imports: [BonosModule], controllers: [ReservasController], providers: [ReservasService] })
export class ReservasModule {}
