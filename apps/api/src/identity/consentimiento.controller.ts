import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import {
  AceptarConsentimientoSchema,
  type AceptarConsentimiento,
  type EstadoConsentimiento,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "./alcance-cliente.guard.js"
import { ConsentimientoService } from "./consentimiento.service.js"
import type { PeticionAutenticada } from "./peticion.js"
import { Roles } from "./roles.decorator.js"

/** El cliente consulta y da su propio consentimiento; su equipo solo lo consulta. */
@Controller()
export class ConsentimientoController {
  constructor(private readonly consentimiento: ConsentimientoService) {}

  private propio(peticion: PeticionAutenticada): string {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario.sub
  }

  @Roles("cliente")
  @Get("consentimiento")
  estado(@Req() peticion: PeticionAutenticada): Promise<EstadoConsentimiento> {
    return this.consentimiento.estado(this.propio(peticion))
  }

  @Roles("cliente")
  @Post("consentimiento")
  aceptar(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(AceptarConsentimientoSchema)) datos: AceptarConsentimiento,
  ): Promise<EstadoConsentimiento> {
    return this.consentimiento.aceptar(this.propio(peticion), datos)
  }

  @Roles("entrenador", "nutricionista")
  @UseGuards(AlcanceClienteGuard)
  @Get("seguimiento/clientes/:clienteId/consentimiento")
  deCliente(
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
  ): Promise<EstadoConsentimiento> {
    return this.consentimiento.estado(clienteId)
  }
}
