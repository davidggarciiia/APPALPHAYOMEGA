import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common"
import {
  CambiarFechaSchema,
  IdSchema,
  type CambiarFecha,
  type ListadoCambiosDeFecha,
  type SesionProgramada,
} from "@alpha-omega/shared"

import { identidad } from "../comun/identidad.js"
import { ZodPipe } from "../comun/zod.pipe.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"

import { AgendaService } from "./agenda.service.js"

/**
 * Cambios de día. El cliente mueve las suyas y el entrenador las de cualquiera;
 * nutricionista y empleado no tienen agenda de entrenamiento.
 */
@Controller("agenda")
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Roles("cliente", "entrenador")
  @Patch("sesiones/:id/fecha")
  async cambiarFecha(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdSchema)) id: string,
    @Body(new ZodPipe(CambiarFechaSchema)) cambio: CambiarFecha,
  ): Promise<SesionProgramada> {
    return this.agenda.cambiarFecha(identidad(peticion), id, cambio)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id/cambios")
  async cambios(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdSchema)) id: string,
  ): Promise<ListadoCambiosDeFecha> {
    return this.agenda.cambios(identidad(peticion), id)
  }
}
