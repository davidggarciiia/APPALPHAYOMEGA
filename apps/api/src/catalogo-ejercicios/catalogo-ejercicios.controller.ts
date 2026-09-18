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
  type BuscarEjercicios,
  type CrearEjercicio,
  type EditarEjercicio,
  type Ejercicio,
  type ListadoEjercicios,
} from "@alpha-omega/shared"
import { z } from "zod"

import { ZodPipe } from "../comun/zod.pipe.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { Roles } from "../identity/roles.decorator.js"

import { CatalogoEjerciciosService } from "./catalogo-ejercicios.service.js"

/** Una ruta es entrada de fuera: sin esto un id cualquiera llega a la base y sale como 500. */
const IdEjercicioSchema = z.uuid()

/**
 * El catalogo tiene una sola frontera: el cliente lee y el entrenador escribe.
 *
 * El nutricionista y el empleado no aparecen en ningun decorador, y eso los
 * deja fuera por el cierre por defecto. No se usa `AlcanceClienteGuard`: un
 * ejercicio no pertenece a ningun cliente, asi que aqui autoriza el rol. Dar
 * acceso al nutricionista por tener clientes asignados seria abrirle un modulo
 * entero por una relacion que no tiene nada que ver.
 *
 * No hay ninguna ruta DELETE y no se anade: un ejercicio se retira.
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
    // El guard de roles ya ha exigido un usuario. Si faltara, se trata como el
    // rol que menos ve.
    return this.catalogo.buscar(peticion.usuario?.rol ?? "cliente", filtros)
  }

  @Roles("entrenador")
  @Post()
  async crear(@Body(new ZodPipe(CrearEjercicioSchema)) datos: CrearEjercicio): Promise<Ejercicio> {
    return this.catalogo.crear(datos)
  }

  @Roles("cliente", "entrenador")
  @Get(":id")
  async leer(@Param("id", new ZodPipe(IdEjercicioSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.leer(id)
  }

  @Roles("entrenador")
  @Patch(":id")
  async editar(
    @Param("id", new ZodPipe(IdEjercicioSchema)) id: string,
    @Body(new ZodPipe(EditarEjercicioSchema)) datos: EditarEjercicio,
  ): Promise<Ejercicio> {
    return this.catalogo.editar(id, datos)
  }

  /** 200 y no el 201 por defecto de un POST: no crea nada, mueve un estado. */
  @Roles("entrenador")
  @Post(":id/retirar")
  @HttpCode(HttpStatus.OK)
  async retirar(@Param("id", new ZodPipe(IdEjercicioSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.retirar(id)
  }

  @Roles("entrenador")
  @Post(":id/reponer")
  @HttpCode(HttpStatus.OK)
  async reponer(@Param("id", new ZodPipe(IdEjercicioSchema)) id: string): Promise<Ejercicio> {
    return this.catalogo.reponer(id)
  }
}
