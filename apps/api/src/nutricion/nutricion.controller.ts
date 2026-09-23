import {
  Body,
  Controller,
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
import { Roles } from "../identity/roles.decorator.js"

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
  constructor(private readonly dietas: DietasService) {}

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
}
