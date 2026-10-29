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
  CambiarBloqueSchema,
  type CambiarBloque,
  type PlanVigente,
  type ProgresionFuerza,
  ConsultarResultadosSchema,
  type ConsultarResultados,
  type ListadoResultados,
  type PlanVigenteRespuesta,
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
  type ListadoAnteriores,
  type ListadoSesiones,
  type PlanAsignado,
  type SesionCliente,
  type SesionEntrenador,
  ConsultarNovedadesSchema,
  MarcarNovedadesLeidasSchema,
  type ConsultarNovedades,
  type ListadoNovedades,
  type MarcarNovedadesLeidas,
  type NovedadesLeidas,
  type ResumenSemanal,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { Roles } from "../identity/roles.decorator.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { PlanesService } from "./planes.service.js"
import { SesionesService } from "./sesiones.service.js"
import { RegistrosService } from "./registros.service.js"
import { AjustesService } from "./ajustes.service.js"
import { NovedadesService } from "./novedades.service.js"
import { ResumenSemanalService } from "./resumen-semanal.service.js"

@Controller("entrenamiento")
export class EntrenamientoController {
  constructor(
    private readonly planes: PlanesService,
    private readonly sesiones: SesionesService,
    private readonly registros: RegistrosService,
    private readonly ajustes: AjustesService,
    private readonly novedades: NovedadesService,
    private readonly resumenSemanal: ResumenSemanalService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("entrenador")
  @Get("resumen-semanal")
  resumen(
    @Req() peticion: PeticionAutenticada,
    @Query(new EntradaApiPipe(ConsultarSemanaSchema)) consulta: ConsultarSemana,
  ): Promise<ResumenSemanal> {
    return this.resumenSemanal.resumen(this.actor(peticion), consulta.semana)
  }

  @Roles("entrenador")
  @Put("sesiones/:id/revision")
  revisar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<SesionEntrenador> {
    return this.novedades.revisar(this.actor(peticion), id)
  }

  @Roles("cliente", "entrenador")
  @Get("clientes/:clienteId/novedades")
  novedadesDeCliente(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarNovedadesSchema)) consulta: ConsultarNovedades,
  ): Promise<ListadoNovedades> {
    return this.novedades.listar(this.actor(peticion), clienteId, consulta)
  }

  @Roles("cliente", "entrenador")
  @Post("sesiones/:id/novedades/leidas")
  @HttpCode(200)
  leerNovedades(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(MarcarNovedadesLeidasSchema)) datos: MarcarNovedadesLeidas,
  ): Promise<NovedadesLeidas> {
    return this.novedades.marcarLeidas(this.actor(peticion), id, datos)
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
  @Get("sesiones/:id/anteriores")
  anteriores(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
  ): Promise<ListadoAnteriores> {
    return this.sesiones.anteriores(this.actor(peticion), id)
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
  @Get("clientes/:clienteId/plan")
  plan(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarSemanaSchema)) consulta: ConsultarSemana,
  ): Promise<PlanVigenteRespuesta> {
    return this.planes.vigente(this.actor(peticion), clienteId, consulta.semana)
  }

  @Roles("cliente", "entrenador")
  @Get("clientes/:clienteId/resultados")
  resultados(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarResultadosSchema)) consulta: ConsultarResultados,
  ): Promise<ListadoResultados> {
    return this.sesiones.resultados(this.actor(peticion), clienteId, consulta.limite)
  }

  @Roles("cliente", "entrenador")
  @Get("clientes/:clienteId/fuerza")
  fuerza(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(z.uuid())) clienteId: string,
  ): Promise<ProgresionFuerza> {
    return this.sesiones.fuerza(this.actor(peticion), clienteId)
  }

  @Roles("entrenador")
  @Patch("planes/:id/bloque")
  cambiarBloque(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(CambiarBloqueSchema)) datos: CambiarBloque,
  ): Promise<PlanVigente> {
    return this.planes.cambiarBloque(this.actor(peticion), id, datos)
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
