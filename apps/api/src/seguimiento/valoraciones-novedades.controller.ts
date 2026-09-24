import { Controller, UseGuards } from "@nestjs/common"

import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import { ValoracionesNovedadesService } from "./valoraciones-novedades.service.js"

/** Avisos de seguimiento para Inicio (E02a). */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class ValoracionesNovedadesController {
  constructor(private readonly novedades: ValoracionesNovedadesService) {}
}
