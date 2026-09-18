import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  CambiarFechaSchema,
  ConsultarCambiosSchema,
  type CambiarFecha,
  type ConsultarCambios,
  type ListadoCambios,
  type SesionProgramada,
} from "@alpha-omega/shared"
import { Roles } from "../identity/roles.decorator.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AgendaService } from "./agenda.service.js"

@Controller("agenda")
@Roles("cliente", "entrenador")
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}
  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }
  @Patch("sesiones/:id/fecha")
  mover(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(CambiarFechaSchema)) datos: CambiarFecha,
  ): Promise<SesionProgramada> {
    return this.agenda.mover(this.actor(peticion), id, datos)
  }
  @Get("sesiones/:id/cambios")
  cambios(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Query(new EntradaApiPipe(ConsultarCambiosSchema)) consulta: ConsultarCambios,
  ): Promise<ListadoCambios> {
    return this.agenda.cambios(this.actor(peticion), id, consulta)
  }
}
