import { Body, Controller, Get, Patch, Req } from "@nestjs/common"
import { CambiosDePerfilSchema, type CambiosDePerfil, type PerfilPropio } from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import type { PeticionAutenticada } from "./peticion.js"
import { PerfilService } from "./perfil.service.js"
import { Roles } from "./roles.decorator.js"

/**
 * El perfil propio de quien haya iniciado sesion.
 *
 * Los cuatro roles entran aqui, y cada uno ve y edita **lo suyo y solo lo suyo**.
 * El identificador no viaja en la URL a proposito: sale del token verificado, asi
 * que no existe la posibilidad de pedir el perfil de otro cambiando un numero.
 *
 * Que el entrenador edite la ficha de un cliente es otra cosa distinta, con otras
 * reglas, y vive en la tarea 17.
 */
@Controller("perfil")
export class PerfilController {
  constructor(private readonly perfil: PerfilService) {}

  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Get()
  async leer(@Req() peticion: PeticionAutenticada): Promise<PerfilPropio> {
    return this.perfil.leer(peticion.usuario?.sub ?? "")
  }

  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Patch()
  async actualizar(
    @Req() peticion: PeticionAutenticada,
    @Body(new ZodPipe(CambiosDePerfilSchema)) cambios: CambiosDePerfil,
  ): Promise<PerfilPropio> {
    return this.perfil.actualizar(peticion.usuario?.sub ?? "", cambios)
  }
}
