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
  CrearSolicitudFotosSchema,
  RevisarSolicitudFotosSchema,
  type CrearSolicitudFotos,
  type ListadoSolicitudesFotos,
  type RevisarSolicitudFotos,
  type SolicitudFotos,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { SolicitudesFotosService } from "./solicitudes-fotos.service.js"

const IdSchema = z.uuid()

/**
 * Solicitudes de fotos del entrenador. El cliente consulta las suyas y aporta
 * con `/medios/subidas`; el nutricionista no recibe fotos en esta entrega.
 */
@Controller("seguimiento/clientes/:clienteId/solicitudes-fotos")
@UseGuards(AlcanceClienteGuard)
export class SolicitudesFotosController {
  constructor(private readonly solicitudes: SolicitudesFotosService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("entrenador")
  @Post()
  crear(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(CrearSolicitudFotosSchema)) datos: CrearSolicitudFotos,
  ): Promise<SolicitudFotos> {
    return this.solicitudes.crear(this.actor(peticion), clienteId, datos)
  }

  @Roles("cliente", "entrenador")
  @Get()
  listar(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<ListadoSolicitudesFotos> {
    return this.solicitudes.listar(clienteId)
  }

  @Roles("entrenador")
  @Post(":id/revision")
  @HttpCode(200)
  revisar(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
    @Body(new EntradaApiPipe(RevisarSolicitudFotosSchema)) datos: RevisarSolicitudFotos,
  ): Promise<SolicitudFotos> {
    return this.solicitudes.revisar(clienteId, id, datos.operacionId)
  }
}
