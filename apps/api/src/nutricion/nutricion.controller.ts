import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import { z } from "zod"
import {
  ConsultarPeriodoSchema,
  FechaAgendaSchema,
  RegistrarComidaSchema,
  type ComidaRegistrada,
  type ConsultarPeriodo,
  type ListadoComidasRegistradas,
  type RegistrarComida,
  ConsultarHistoricoDietasSchema,
  DescartarBorradorDietaSchema,
  GuardarBorradorDietaSchema,
  PublicarDietaSchema,
  type BorradorDieta,
  type ConsultarHistoricoDietas,
  type DescartarBorradorDieta,
  type DietaDelHistorico,
  type DietaPublicada,
  type GuardarBorradorDieta,
  type LecturaBorradorDieta,
  type LecturaDietaVigente,
  type ListadoDietas,
  type PublicarDieta,
} from "@alpha-omega/shared"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { RequiereConsentimientoDeSalud } from "../identity/consentimiento.guard.js"
import { Roles } from "../identity/roles.decorator.js"

import { ComidasService } from "./comidas.service.js"
import { DietasService } from "./dietas.service.js"

const IdSchema = z.uuid()

/**
 * Dietas de un cliente. El rol decide qué operación se puede hacer y
 * `AlcanceClienteGuard` sobre qué cliente: el cliente solo el suyo, el
 * nutricionista solo sus asignados que no están de baja.
 */
@Controller("nutricion/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class NutricionController {
  constructor(
    private readonly dietas: DietasService,
    private readonly comidas: ComidasService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  /** La dieta publicada. Es lo único que ve el cliente. */
  @Roles("cliente", "entrenador", "nutricionista")
  @Get("dieta")
  vigente(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<LecturaDietaVigente> {
    return this.dietas.vigente(clienteId)
  }

  @Roles("entrenador", "nutricionista")
  @Get("borrador")
  leerBorrador(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<LecturaBorradorDieta> {
    return this.dietas.leerBorrador(clienteId)
  }

  @Roles("entrenador", "nutricionista")
  @Put("borrador")
  guardarBorrador(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(GuardarBorradorDietaSchema)) datos: GuardarBorradorDieta,
  ): Promise<BorradorDieta> {
    return this.dietas.guardarBorrador(this.actor(peticion), clienteId, datos)
  }

  @Roles("entrenador", "nutricionista")
  @Post("borrador/publicar")
  @HttpCode(HttpStatus.OK)
  publicar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(PublicarDietaSchema)) datos: PublicarDieta,
  ): Promise<DietaPublicada> {
    return this.dietas.publicar(this.actor(peticion), clienteId, datos)
  }

  @Roles("entrenador", "nutricionista")
  @Post("borrador/descartar")
  @HttpCode(HttpStatus.NO_CONTENT)
  async descartar(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(DescartarBorradorDietaSchema)) datos: DescartarBorradorDieta,
  ): Promise<void> {
    await this.dietas.descartar(clienteId, datos.revision)
  }

  @Roles("entrenador", "nutricionista")
  @Get("historico")
  historico(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarHistoricoDietasSchema)) consulta: ConsultarHistoricoDietas,
  ): Promise<ListadoDietas> {
    return this.dietas.historico(clienteId, consulta)
  }

  @Roles("entrenador", "nutricionista")
  @Get("dietas/:dietaId")
  delHistorico(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("dietaId", new EntradaApiPipe(IdSchema)) dietaId: string,
  ): Promise<DietaDelHistorico> {
    return this.dietas.delHistorico(clienteId, dietaId)
  }

  /** Marcar una comida del día como hecha, con lo que eligió. Solo el cliente. */
  @Roles("cliente")
  @RequiereConsentimientoDeSalud()
  @Put("comidas/:fecha/:comidaId")
  registrarComida(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("fecha", new EntradaApiPipe(FechaAgendaSchema)) fecha: string,
    @Param("comidaId", new EntradaApiPipe(IdSchema)) comidaId: string,
    @Body(new EntradaApiPipe(RegistrarComidaSchema)) datos: RegistrarComida,
  ): Promise<ComidaRegistrada> {
    return this.comidas.registrar(clienteId, fecha, comidaId, datos)
  }

  @Roles("cliente")
  @Delete("comidas/:fecha/:comidaId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async quitarComida(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("fecha", new EntradaApiPipe(FechaAgendaSchema)) fecha: string,
    @Param("comidaId", new EntradaApiPipe(IdSchema)) comidaId: string,
  ): Promise<void> {
    await this.comidas.quitar(clienteId, fecha, comidaId)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("comidas")
  comidasRegistradas(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarPeriodoSchema)) periodo: ConsultarPeriodo,
  ): Promise<ListadoComidasRegistradas> {
    return this.comidas.listar(clienteId, periodo)
  }
}
