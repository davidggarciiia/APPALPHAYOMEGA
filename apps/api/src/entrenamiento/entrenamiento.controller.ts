import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import {
  AsignarPlanSchema,
  ConsultarPanelSchema,
  ConsultarSesionesSchema,
  IdSchema,
  type AsignarPlan,
  type ConsultarPanel,
  type ConsultarSesiones,
  type ListadoEjercicios,
  type ListadoPlanes,
  type ListadoSesiones,
  type PanelSemanal,
  type PlanAsignado,
  type ResultadoAnulacion,
  type ResultadoEntrenamiento,
  type SesionCliente,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import { identidad } from "../comun/identidad.js"
import { ZodPipe } from "../comun/zod.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"

import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"

/**
 * Planes, sesiones y resultados.
 *
 * Nutricionista y empleado no aparecen en ningún `@Roles`: no prescriben ni
 * registran entrenos. Con `AlcanceClienteGuard` además, añadir al nutricionista
 * le abriría los clientes que tiene asignados, y eso sería una decisión nueva.
 */
@Controller("entrenamiento")
export class EntrenamientoController {
  constructor(
    private readonly sesiones: SesionesService,
    private readonly planes: PlanesService,
  ) {}

  @Roles("entrenador")
  @Post("clientes/:clienteId/planes")
  async asignar(
    @Param("clienteId", new ZodPipe(IdSchema)) clienteId: string,
    @Body(new ZodPipe(AsignarPlanSchema)) datos: AsignarPlan,
  ): Promise<PlanAsignado> {
    return this.planes.asignar(clienteId, datos)
  }

  @Roles("entrenador")
  @Get("clientes/:clienteId/planes")
  async planesDeCliente(
    @Param("clienteId", new ZodPipe(IdSchema)) clienteId: string,
  ): Promise<ListadoPlanes> {
    return this.sesiones.planes(clienteId)
  }

  @Roles("cliente", "entrenador")
  @UseGuards(AlcanceClienteGuard)
  @Get("clientes/:clienteId/sesiones")
  async sesionesDeCliente(
    @Param("clienteId", new ZodPipe(IdSchema)) clienteId: string,
    @Query(new ZodPipe(ConsultarSesionesSchema)) consulta: ConsultarSesiones,
  ): Promise<ListadoSesiones> {
    return this.sesiones.deCliente(clienteId, consulta)
  }

  /** El panel del entrenador. Antes que `sesiones/:id` para no quedar tapado. */
  @Roles("entrenador")
  @Get("sesiones")
  async panel(
    @Query(new ZodPipe(ConsultarPanelSchema)) consulta: ConsultarPanel,
  ): Promise<PanelSemanal> {
    return this.sesiones.panel(consulta)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id")
  async leer(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdSchema)) id: string,
  ): Promise<SesionCliente | SesionEntrenador> {
    return this.sesiones.leer(identidad(peticion), id)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id/ejercicios")
  async ejercicios(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdSchema)) id: string,
  ): Promise<ListadoEjercicios> {
    return this.sesiones.ejercicios(identidad(peticion), id)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id/resultado")
  async resultado(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdSchema)) id: string,
  ): Promise<ResultadoEntrenamiento> {
    return this.sesiones.resultado(identidad(peticion), id)
  }

  @Roles("entrenador")
  @Delete("sesiones/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async anularSesion(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<void> {
    await this.planes.anularSesion(id)
  }

  @Roles("entrenador")
  @Post("planes/:id/anular")
  @HttpCode(HttpStatus.OK)
  async anularPlan(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<ResultadoAnulacion> {
    return this.planes.anularPlan(id)
  }
}
