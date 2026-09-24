import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import {
  AtenderMolestiaSchema,
  ConsultarMolestiasSchema,
  RegistrarMolestiaSchema,
  type AtenderMolestia,
  type ConsultarMolestias,
  type ListadoMolestias,
  type Molestia,
  type RegistrarMolestia,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { MolestiasService } from "./molestias.service.js"

@Controller("entrenamiento")
export class MolestiasController {
  constructor(private readonly molestias: MolestiasService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  /** El cliente avisa desde su sesión. Repetir la operación devuelve el mismo aviso. */
  @Roles("cliente")
  @Post("sesiones/:id/molestias")
  registrar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(RegistrarMolestiaSchema)) datos: RegistrarMolestia,
  ): Promise<Molestia> {
    return this.molestias.registrar(this.actor(peticion), id, datos)
  }

  @Roles("cliente", "entrenador")
  @Get("clientes/:clienteId/molestias")
  listar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarMolestiasSchema)) consulta: ConsultarMolestias,
  ): Promise<ListadoMolestias> {
    return this.molestias.listar(this.actor(peticion), clienteId, consulta)
  }

  /** 200: no crea nada, cierra el aviso con la respuesta del entrenador. */
  @Roles("entrenador")
  @Post("molestias/:id/atender")
  @HttpCode(200)
  atender(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(AtenderMolestiaSchema)) datos: AtenderMolestia,
  ): Promise<Molestia> {
    return this.molestias.atender(this.actor(peticion), id, datos)
  }
}
