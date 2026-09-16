import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common"
import {
  CrearUsuarioSchema,
  FiltrosDeListadoSchema,
  type CrearUsuario,
  type FiltrosDeListado,
  type ListadoUsuarios,
  type UsuarioCreado,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import type { PeticionAutenticada } from "./peticion.js"
import { Roles } from "./roles.decorator.js"
import { UsuariosService } from "./usuarios.service.js"

@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /**
   * La cartera del entrenador.
   *
   * Los filtros pasan por el mismo pipe de validacion que los cuerpos. La cadena
   * de consulta es entrada de fuera igual que el cuerpo de una peticion, y
   * dejarla sin validar es la clase de hueco que nadie mira porque "solo son
   * parametros".
   */
  @Roles("entrenador")
  @Get()
  async listar(
    @Req() peticion: PeticionAutenticada,
    @Query(new ZodPipe(FiltrosDeListadoSchema)) filtros: FiltrosDeListado,
  ): Promise<ListadoUsuarios> {
    return this.usuarios.listar(peticion.usuario?.sub ?? "", filtros)
  }

  /**
   * Solo el entrenador. Es su cartera y su negocio.
   *
   * No existe ninguna otra ruta que cree cuentas: sin este endpoint no se entra
   * en la aplicacion.
   */
  @Roles("entrenador")
  @Post()
  async crear(@Body(new ZodPipe(CrearUsuarioSchema)) datos: CrearUsuario): Promise<UsuarioCreado> {
    return this.usuarios.crear(datos)
  }
}
