import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put, Req } from "@nestjs/common"
import {
  IdUsuarioSchema,
  type AsignacionesDeNutricionista,
  type ListadoUsuarios,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import { AsignacionesService } from "./asignaciones.service.js"
import type { PeticionAutenticada } from "./peticion.js"
import { Roles } from "./roles.decorator.js"

/**
 * Quien ve a quien.
 *
 * Solo el entrenador reparte acceso: es su cartera y sus clientes. El
 * nutricionista solo puede preguntar por los suyos, y para eso tiene su propia
 * ruta, que no admite identificador de nadie: sale del token verificado.
 */
@Controller()
export class AsignacionesController {
  constructor(private readonly asignaciones: AsignacionesService) {}

  /** A quien ve un nutricionista. Para la pantalla de reparto del entrenador. */
  @Roles("entrenador")
  @Get("nutricionistas/:nutricionistaId/clientes")
  async deNutricionista(
    @Param("nutricionistaId", new ZodPipe(IdUsuarioSchema)) nutricionistaId: string,
  ): Promise<AsignacionesDeNutricionista> {
    return this.asignaciones.deNutricionista(nutricionistaId)
  }

  /** Da acceso. Idempotente: asignar dos veces no crea dos filas. */
  @Roles("entrenador")
  @Put("nutricionistas/:nutricionistaId/clientes/:clienteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async asignar(
    @Req() peticion: PeticionAutenticada,
    @Param("nutricionistaId", new ZodPipe(IdUsuarioSchema)) nutricionistaId: string,
    @Param("clienteId", new ZodPipe(IdUsuarioSchema)) clienteId: string,
  ): Promise<void> {
    await this.asignaciones.asignar(peticion.usuario?.sub ?? "", nutricionistaId, clienteId)
  }

  /**
   * Retira el acceso.
   *
   * Surte efecto en la peticion siguiente, no cuando caduque nada: el alcance se
   * consulta en cada peticion contra esta tabla.
   */
  @Roles("entrenador")
  @Delete("nutricionistas/:nutricionistaId/clientes/:clienteId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async retirar(
    @Req() peticion: PeticionAutenticada,
    @Param("nutricionistaId", new ZodPipe(IdUsuarioSchema)) nutricionistaId: string,
    @Param("clienteId", new ZodPipe(IdUsuarioSchema)) clienteId: string,
  ): Promise<void> {
    await this.asignaciones.retirar(peticion.usuario?.sub ?? "", nutricionistaId, clienteId)
  }

  /**
   * La lista del propio nutricionista.
   *
   * No lleva identificador en la ruta a proposito. El unico nutricionista del
   * que puede preguntar es el mismo, y eso no se comprueba: se toma del token
   * que el servidor ya verifico contra la base.
   */
  @Roles("nutricionista")
  @Get("mis-clientes")
  async misClientes(@Req() peticion: PeticionAutenticada): Promise<ListadoUsuarios> {
    return this.asignaciones.misClientes(peticion.usuario?.sub ?? "")
  }
}
