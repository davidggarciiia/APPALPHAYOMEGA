import { Controller, UseGuards } from "@nestjs/common"

import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import { EvolucionValoracionesService } from "./evolucion-valoraciones.service.js"

/** `GET /seguimiento/clientes/:clienteId/evolucion` (E01a). */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class EvolucionValoracionesController {
  constructor(private readonly evolucion: EvolucionValoracionesService) {}
}
