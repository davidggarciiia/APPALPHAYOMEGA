import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  AsignarPlanSchema,
  ConsultarSemanaSchema,
  type AsignarPlan,
  type ConsultarSemana,
  type ListadoSesiones,
  type PlanAsignado,
  type SesionCliente,
  type SesionEntrenador,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { Roles } from "../identity/roles.decorator.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"

@Controller("entrenamiento")
export class EntrenamientoController {
  constructor(
    private readonly planes: PlanesService,
    private readonly sesiones: SesionesService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("entrenador")
  @Post("clientes/:clienteId/planes")
  asignar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Body(new EntradaApiPipe(AsignarPlanSchema)) datos: AsignarPlan,
  ): Promise<PlanAsignado> {
    return this.planes.asignar(this.actor(peticion), clienteId, datos)
  }

  @Roles("cliente", "entrenador")
  @Get("clientes/:clienteId/sesiones")
  semana(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarSemanaSchema)) consulta: ConsultarSemana,
  ): Promise<ListadoSesiones> {
    return this.sesiones.semana(this.actor(peticion), clienteId, consulta.semana)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id")
  leer(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<SesionCliente | SesionEntrenador> {
    return this.sesiones.leer(this.actor(peticion), id)
  }
}
