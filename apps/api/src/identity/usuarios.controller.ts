import { Body, Controller, Post } from "@nestjs/common"
import { CrearUsuarioSchema, type CrearUsuario, type UsuarioCreado } from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import { Roles } from "./roles.decorator.js"
import { UsuariosService } from "./usuarios.service.js"

@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

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
