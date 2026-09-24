import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import {
  CambiarDiaSchema,
  ConsultarPeriodoSchema,
  FechaAgendaSchema,
  RegistrarMedidaSchema,
  RegistrarPruebaSchema,
  type CambiarDia,
  type ConsultarPeriodo,
  type DiaDeSeguimiento,
  type ListadoDias,
  type ListadoMedidas,
  type ListadoPruebas,
  type Medida,
  type PruebaFisica,
  type RegistrarMedida,
  type RegistrarPrueba,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { SeguimientoService } from "./seguimiento.service.js"

const IdSchema = z.uuid()

/**
 * Seguimiento de un cliente. El día lo apunta solo el cliente; las medidas y
 * las pruebas también las toma su equipo. `AlcanceClienteGuard` limita al
 * cliente a lo suyo y al nutricionista a sus asignados.
 */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class SeguimientoController {
  constructor(private readonly seguimiento: SeguimientoService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente")
  @Put("dias/:fecha")
  cambiarDia(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("fecha", new EntradaApiPipe(FechaAgendaSchema)) fecha: string,
    @Body(new EntradaApiPipe(CambiarDiaSchema)) cambio: CambiarDia,
  ): Promise<DiaDeSeguimiento> {
    return this.seguimiento.cambiarDia(clienteId, fecha, cambio)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("dias")
  dias(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarPeriodoSchema)) periodo: ConsultarPeriodo,
  ): Promise<ListadoDias> {
    return this.seguimiento.dias(clienteId, periodo)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Post("medidas")
  registrarMedida(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(RegistrarMedidaSchema)) datos: RegistrarMedida,
  ): Promise<Medida> {
    return this.seguimiento.registrarMedida(this.actor(peticion), clienteId, datos)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("medidas")
  medidas(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<ListadoMedidas> {
    return this.seguimiento.medidas(clienteId)
  }

  @Roles("cliente", "entrenador")
  @Post("pruebas")
  registrarPrueba(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(RegistrarPruebaSchema)) datos: RegistrarPrueba,
  ): Promise<PruebaFisica> {
    return this.seguimiento.registrarPrueba(this.actor(peticion), clienteId, datos)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("pruebas")
  pruebas(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<ListadoPruebas> {
    return this.seguimiento.pruebas(clienteId)
  }
}
