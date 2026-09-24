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
  CambiarValoracionSchema,
  ConsultarValoracionesSchema,
  CrearValoracionSchema,
  GuardarPlantillaValoracionSchema,
  GuardarProximaRevisionSchema,
  PublicarValoracionSchema,
  VincularFotoSchema,
  type CambiarValoracion,
  type ConsultarValoraciones,
  type CrearValoracion,
  type GuardarPlantillaValoracion,
  type GuardarProximaRevision,
  type ListadoFotos,
  type ListadoValoraciones,
  type ListadoValoracionesPublicadas,
  type MedioFoto,
  type PlantillaValoracion,
  type ProximaRevision,
  type PublicacionValoracion,
  type PublicarValoracion,
  type ValoracionCliente,
  type ValoracionCorporal,
  type ValoracionProfesional,
  type VincularFoto,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { RequiereConsentimientoDeSalud } from "../identity/consentimiento.guard.js"
import { Roles } from "../identity/roles.decorator.js"
import { PlantillasValoracionService } from "./plantillas-valoracion.service.js"
import { ValoracionesService } from "./valoraciones.service.js"

const IdSchema = z.uuid()

/**
 * Valoración inicial y revisiones. Solo el entrenador configura, escribe y
 * publica; el cliente y el nutricionista asignado leen lo publicado, cada uno
 * con su proyección. `AlcanceClienteGuard` limita a cada rol a sus clientes.
 */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class ValoracionesController {
  constructor(
    private readonly valoraciones: ValoracionesService,
    private readonly plantillas: PlantillasValoracionService,
  ) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("entrenador")
  @Get("plantilla-valoracion")
  plantilla(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<PlantillaValoracion> {
    return this.plantillas.leer(clienteId)
  }

  @Roles("entrenador")
  @Put("plantilla-valoracion")
  guardarPlantilla(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(GuardarPlantillaValoracionSchema)) datos: GuardarPlantillaValoracion,
  ): Promise<PlantillaValoracion> {
    return this.plantillas.guardar(clienteId, datos)
  }

  @Roles("cliente", "entrenador")
  @Get("proxima-revision")
  proximaRevision(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
  ): Promise<ProximaRevision> {
    return this.valoraciones.proximaRevision(clienteId)
  }

  @Roles("entrenador")
  @Put("proxima-revision")
  guardarProximaRevision(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(GuardarProximaRevisionSchema)) datos: GuardarProximaRevision,
  ): Promise<ProximaRevision> {
    return this.valoraciones.guardarProximaRevision(clienteId, datos)
  }

  @Roles("entrenador")
  @RequiereConsentimientoDeSalud()
  @Post("valoraciones")
  crear(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Body(new EntradaApiPipe(CrearValoracionSchema)) datos: CrearValoracion,
  ): Promise<ValoracionProfesional> {
    return this.valoraciones.crear(this.actor(peticion), clienteId, datos)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("valoraciones")
  listar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarValoracionesSchema)) consulta: ConsultarValoraciones,
  ): Promise<ListadoValoraciones | ListadoValoracionesPublicadas> {
    return this.valoraciones.listar(this.actor(peticion), clienteId, consulta)
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("valoraciones/:id")
  leer(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
  ): Promise<ValoracionProfesional | ValoracionCliente | ValoracionCorporal> {
    return this.valoraciones.leer(this.actor(peticion), clienteId, id)
  }

  @Roles("entrenador")
  @RequiereConsentimientoDeSalud()
  @Post("valoraciones/:id/publicaciones")
  publicar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
    @Body(new EntradaApiPipe(PublicarValoracionSchema)) datos: PublicarValoracion,
  ): Promise<PublicacionValoracion> {
    return this.valoraciones.publicar(this.actor(peticion), clienteId, id, datos)
  }

  @Roles("entrenador")
  @RequiereConsentimientoDeSalud()
  @Post("valoraciones/:id/fotos")
  vincularFoto(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
    @Body(new EntradaApiPipe(VincularFotoSchema)) datos: VincularFoto,
  ): Promise<MedioFoto> {
    return this.valoraciones.vincularFoto(clienteId, id, datos.medioId)
  }

  /** El nutricionista no recibe fotos en esta entrega. */
  @Roles("cliente", "entrenador")
  @Get("valoraciones/:id/fotos")
  fotos(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
  ): Promise<ListadoFotos> {
    return this.valoraciones.fotos(this.actor(peticion), clienteId, id)
  }

  @Roles("entrenador")
  @RequiereConsentimientoDeSalud()
  @Put("valoraciones/:id")
  cambiar(
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Param("id", new EntradaApiPipe(IdSchema)) id: string,
    @Body(new EntradaApiPipe(CambiarValoracionSchema)) datos: CambiarValoracion,
  ): Promise<ValoracionProfesional> {
    return this.valoraciones.cambiar(clienteId, id, datos)
  }
}
