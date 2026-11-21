import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  AbrirHuecosSchema,
  ConsultarHuecosSchema,
  type AbrirHuecos,
  type ConsultarHuecos,
  type HuecoDisponibilidad,
  type ListadoHuecos,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { DisponibilidadService } from "./disponibilidad.service.js"

@Controller("disponibilidad/huecos")
@Roles("entrenador")
export class DisponibilidadController {
  constructor(private readonly disponibilidad: DisponibilidadService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Post()
  abrir(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(AbrirHuecosSchema)) datos: AbrirHuecos,
  ): Promise<ListadoHuecos> {
    return this.disponibilidad.abrir(this.actor(peticion), datos)
  }

  @Get()
  listar(
    @Req() peticion: PeticionAutenticada,
    @Query(new EntradaApiPipe(ConsultarHuecosSchema)) consulta: ConsultarHuecos,
  ): Promise<ListadoHuecos> {
    return this.disponibilidad.listar(this.actor(peticion), consulta)
  }

  @Patch(":id/cerrar")
  cerrar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(z.strictObject({}))) _datos: Record<string, never>,
  ): Promise<HuecoDisponibilidad> {
    return this.disponibilidad.cerrar(this.actor(peticion), id)
  }
}
