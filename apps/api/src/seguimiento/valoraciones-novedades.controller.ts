import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import {
  LeerAvisosSeguimientoSchema,
  type LeerAvisosSeguimiento,
  type ListadoAvisosSeguimiento,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { ValoracionesNovedadesService } from "./valoraciones-novedades.service.js"

const IdSchema = z.uuid()

/**
 * Avisos de seguimiento para Inicio (E02a). Cada usuario ve los suyos y guarda
 * su propia lectura; el nutricionista no los recibe en esta entrega.
 */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class ValoracionesNovedadesController {
  constructor(private readonly novedades: ValoracionesNovedadesService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente", "entrenador")
  @Get("avisos")
  avisos(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<ListadoAvisosSeguimiento> {
    return this.novedades.avisos(this.actor(peticion), clienteId)
  }

  /** Leer no revisa: la solicitud y sus fotos quedan como estaban. */
  @Roles("cliente", "entrenador")
  @Post("avisos/leidos")
  @HttpCode(200)
  leer(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(LeerAvisosSeguimientoSchema)) datos: LeerAvisosSeguimiento,
  ): Promise<ListadoAvisosSeguimiento> {
    return this.novedades.leer(this.actor(peticion), clienteId, datos)
  }
}
