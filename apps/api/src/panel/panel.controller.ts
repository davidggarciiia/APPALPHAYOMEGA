import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common"
import type { PanelHoy } from "@alpha-omega/shared"

import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { PanelService } from "./panel.service.js"

/** El panel es del entrenador: ni el cliente, ni el nutricionista, ni el empleado lo ven. */
@Controller("panel")
export class PanelController {
  constructor(private readonly panel: PanelService) {}

  @Roles("entrenador")
  @Get("hoy")
  hoy(@Req() peticion: PeticionAutenticada): Promise<PanelHoy> {
    if (!peticion.usuario) throw new UnauthorizedException()
    return this.panel.hoy(peticion.usuario)
  }
}
