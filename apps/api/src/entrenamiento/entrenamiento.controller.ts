import {
  Body,
  Controller,
  Get,
  Put,
  Patch,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  AsignarPlanSchema,
  CambiarPrescripcionSchema,
  type CambiarPrescripcion,
  GuardarBorradorSchema,
  EnviarEntrenamientoSchema,
  type GuardarBorrador,
  type EnviarEntrenamiento,
  type Borrador,
  type ResultadoEntrenamiento,
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
import { RegistrosService } from "./registros.service.js"
import { AjustesService } from "./ajustes.service.js"

@Controller("entrenamiento")
export class EntrenamientoController {
  constructor(
    private readonly planes: PlanesService,
    private readonly sesiones: SesionesService,
    private readonly registros: RegistrosService,
    private readonly ajustes: AjustesService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("entrenador")
  @Patch("sesiones/:id/prescripcion")
  ajustar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(CambiarPrescripcionSchema)) datos: CambiarPrescripcion,
  ): Promise<SesionEntrenador> {
    return this.ajustes.ajustar(this.actor(peticion), id, datos)
  }

  @Roles("cliente")
  @Get("sesiones/:id/borrador")
  borrador(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<Borrador | null> {
    return this.registros.leerBorrador(this.actor(peticion), id)
  }

  @Roles("cliente")
  @Put("sesiones/:id/borrador")
  guardar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(GuardarBorradorSchema)) datos: GuardarBorrador,
  ): Promise<Borrador> {
    return this.registros.guardar(this.actor(peticion), id, datos)
  }

  @Roles("cliente")
  @Post("sesiones/:id/enviar")
  @HttpCode(200)
  enviar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(EnviarEntrenamientoSchema)) datos: EnviarEntrenamiento,
  ): Promise<ResultadoEntrenamiento> {
    return this.registros.enviar(this.actor(peticion), id, datos)
  }

  @Roles("cliente", "entrenador")
  @Get("sesiones/:id/resultado")
  resultado(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<ResultadoEntrenamiento> {
    return this.registros.resultado(this.actor(peticion), id)
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
