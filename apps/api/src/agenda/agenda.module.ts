import { Module } from "@nestjs/common"
import { PlanesModule } from "../planes/planes.module.js"
import { AgendaService } from "./agenda.service.js"
import { AgendaController } from "./agenda.controller.js"
import { BajasAgenda } from "./bajas-agenda.js"
import { HorarioService } from "./horario.service.js"
import { ReservasController } from "./reservas.controller.js"
import { ReservasService } from "./reservas.service.js"

@Module({
  imports: [PlanesModule],
  controllers: [AgendaController, ReservasController],
  providers: [AgendaService, ReservasService, HorarioService, BajasAgenda],
  exports: [AgendaService, ReservasService],
})
export class AgendaModule {}
