import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common"
import {
  BuscarEjerciciosSchema,
  CrearEjercicioSchema,
  EditarEjercicioSchema,
  EjerciciosPorIdSchema,
  IdSchema,
  type BuscarEjercicios,
  type CrearEjercicio,
  type EditarEjercicio,
  type Ejercicio,
  type EjerciciosPorId,
  type ListadoEjercicios,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"

import { CatalogoEjerciciosService } from "./catalogo-ejercicios.service.js"

/**
 * El catálogo de ejercicios.
 *
 * Nutricionista y empleado no aparecen en ninguna ruta: no prescriben entrenos
 * (matriz de roles de SPEC-catalogo-ejercicios.md). No existe ruta de borrado.
 */
@Controller("ejercicios")
export class CatalogoEjerciciosController {
  constructor(private readonly catalogo: CatalogoEjerciciosService) {}

  @Roles("cliente", "entrenador")
  @Get()
  async buscar(
    @Req() peticion: PeticionAutenticada,
    @Query(new ZodPipe(BuscarEjerciciosSchema)) filtros: BuscarEjercicios,
  ): Promise<ListadoEjercicios> {
    return this.catalogo.buscar(peticion.usuario?.rol ?? "cliente", filtros)
  }

  /** Antes que `/:id`, para que la ruta literal no quede tapada por el parámetro. */
  @Roles("cliente", "entrenador")
  @Get("por-id")
  async porIds(
    @Query(new ZodPipe(EjerciciosPorIdSchema)) consulta: EjerciciosPorId,
  ): Promise<ListadoEjercicios> {
    return this.catalogo.porIds(consulta.ids)
  }

  @Roles("cliente", "entrenador")
  @Get(":id")
  async leer(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.leer(id)
  }

  @Roles("entrenador")
  @Post()
  async crear(@Body(new ZodPipe(CrearEjercicioSchema)) datos: CrearEjercicio): Promise<Ejercicio> {
    return this.catalogo.crear(datos)
  }

  @Roles("entrenador")
  @Patch(":id")
  async editar(
    @Param("id", new ZodPipe(IdSchema)) id: string,
    @Body(new ZodPipe(EditarEjercicioSchema)) datos: EditarEjercicio,
  ): Promise<Ejercicio> {
    return this.catalogo.editar(id, datos)
  }

  @Roles("entrenador")
  @Post(":id/retirar")
  @HttpCode(HttpStatus.OK)
  async retirar(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.retirar(id)
  }

  @Roles("entrenador")
  @Post(":id/reponer")
  @HttpCode(HttpStatus.OK)
  async reponer(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.reponer(id)
  }
}
