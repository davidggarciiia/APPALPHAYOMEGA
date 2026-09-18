import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common"
import { z } from "zod"
import {
  ConsultarRutinasSchema,
  EditarRutinaSchema,
  GuardarRutinaSchema,
  type ConsultarRutinas,
  type EditarRutina,
  type GuardarRutina,
  type ListadoRutinas,
  type RutinaGuardada,
} from "@alpha-omega/shared"
import { EntradaApiPipe } from "../comun/entrada-api.pipe.js"
import { Roles } from "../identity/roles.decorator.js"
import type { PeticionAutenticada } from "../identity/peticion.js"
import { RutinasService } from "./rutinas.service.js"

@Controller("entrenamiento/rutinas")
@Roles("entrenador")
export class RutinasController {
  constructor(private readonly rutinas: RutinasService) {}
  @Get()
  listar(
    @Query(new EntradaApiPipe(ConsultarRutinasSchema)) consulta: ConsultarRutinas,
  ): Promise<ListadoRutinas> {
    return this.rutinas.listar(consulta)
  }
  @Get(":id")
  leer(@Param("id", new EntradaApiPipe(z.uuid())) id: string): Promise<RutinaGuardada> {
    return this.rutinas.leer(id)
  }
  @Post()
  guardar(
    @Req() peticion: PeticionAutenticada,
    @Body(new EntradaApiPipe(GuardarRutinaSchema)) datos: GuardarRutina,
  ): Promise<RutinaGuardada> {
    if (!peticion.usuario) throw new UnauthorizedException()
    return this.rutinas.guardar(peticion.usuario.sub, datos)
  }
  @Patch(":id")
  editar(
    @Param("id", new EntradaApiPipe(z.uuid())) id: string,
    @Body(new EntradaApiPipe(EditarRutinaSchema)) datos: EditarRutina,
  ): Promise<RutinaGuardada> {
    return this.rutinas.editar(id, datos)
  }
}
