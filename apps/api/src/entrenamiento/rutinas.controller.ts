import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common"
import {
  EditarRutinaSchema,
  GuardarRutinaSchema,
  IdSchema,
  type EditarRutina,
  type GuardarRutina,
  type ListadoRutinas,
  type RutinaGuardada,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"
import { Roles } from "../identity/roles.decorator.js"

import { RutinasService } from "./rutinas.service.js"

/** Biblioteca de rutinas. Solo el entrenador las crea, adapta y consulta. */
@Controller("entrenamiento/rutinas")
export class RutinasController {
  constructor(private readonly rutinas: RutinasService) {}

  @Roles("entrenador")
  @Get()
  async listar(): Promise<ListadoRutinas> {
    return this.rutinas.listar()
  }

  @Roles("entrenador")
  @Post()
  async crear(
    @Body(new ZodPipe(GuardarRutinaSchema)) datos: GuardarRutina,
  ): Promise<RutinaGuardada> {
    return this.rutinas.crear(datos)
  }

  @Roles("entrenador")
  @Get(":id")
  async leer(@Param("id", new ZodPipe(IdSchema)) id: string): Promise<RutinaGuardada> {
    return this.rutinas.leer(id)
  }

  @Roles("entrenador")
  @Patch(":id")
  async editar(
    @Param("id", new ZodPipe(IdSchema)) id: string,
    @Body(new ZodPipe(EditarRutinaSchema)) datos: EditarRutina,
  ): Promise<RutinaGuardada> {
    return this.rutinas.editar(id, datos)
  }
}
