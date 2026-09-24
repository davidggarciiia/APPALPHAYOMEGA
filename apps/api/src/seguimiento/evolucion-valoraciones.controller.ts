import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common"
import {
  ConsultarEvolucionSchema,
  type ConsultarEvolucion,
  type Evolucion,
} from "@alpha-omega/shared"
import { z } from "zod"

import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { AlcanceClienteGuard } from "../identity/alcance-cliente.guard.js"
import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"
import { EvolucionValoracionesService } from "./evolucion-valoraciones.service.js"

const IdSchema = z.uuid()

/**
 * `GET /seguimiento/clientes/:clienteId/evolucion` (E01a): publicaciones
 * vigentes e histórico en series comparables. `AlcanceClienteGuard` limita al
 * cliente a lo suyo y al nutricionista a sus asignados; el servicio le retira
 * además las pruebas.
 */
@Controller("seguimiento/clientes/:clienteId")
@UseGuards(AlcanceClienteGuard)
export class EvolucionValoracionesController {
  constructor(private readonly evolucion: EvolucionValoracionesService) {}

  private actor(peticion: PeticionAutenticada): IdentidadVerificada {
    if (!peticion.usuario) throw new UnauthorizedException()
    return peticion.usuario
  }

  @Roles("cliente", "entrenador", "nutricionista")
  @Get("evolucion")
  consultar(
    @Req() peticion: PeticionAutenticada,
    @Param("clienteId", new EntradaApiPipe(IdSchema)) clienteId: string,
    @Query(new EntradaApiPipe(ConsultarEvolucionSchema)) consulta: ConsultarEvolucion,
  ): Promise<Evolucion> {
    return this.evolucion.evolucion(this.actor(peticion), clienteId, consulta)
  }
}
