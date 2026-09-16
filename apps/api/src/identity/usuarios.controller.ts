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
  CambiosDeUsuarioSchema,
  CorreoDeUsuarioSchema,
  CrearUsuarioSchema,
  FiltrosDeListadoSchema,
  IdUsuarioSchema,
  type CambiosDeUsuario,
  type CorreoDeUsuario,
  type CrearUsuario,
  type FichaDeUsuario,
  type FiltrosDeListado,
  type ListadoUsuarios,
  type ResultadoDeEnvio,
  type UsuarioCreado,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import type { PeticionAutenticada } from "./peticion.js"
import { Roles } from "./roles.decorator.js"
import { UsuariosService } from "./usuarios.service.js"

/**
 * La cartera del entrenador: quien existe, quien puede entrar y quien no.
 *
 * Todas las rutas declaran su rol. Ninguna es publica y ninguna borra: dar de
 * baja mueve el estado y conserva el historico (requisito 14).
 *
 * No se usa `AlcanceClienteGuard` aqui. Ese guard lee `params.clienteId` y
 * ademas concede al entrenador sin consultar nada, asi que sobre estas rutas
 * seria un 403 por un nombre de parametro y cero proteccion adicional.
 */
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
   *
   * Se declara antes que `GET /:id`: Nest resuelve por orden dentro del mismo
   * verbo, y al reves una ruta literal quedaria tapada por el parametro.
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

  /**
   * La ficha de una persona.
   *
   * El identificador de la ruta se valida como cualquier otra entrada. Sin eso,
   * cualquier cosa llega hasta la base y vuelve como un 500 en lugar de un 400.
   */
  @Roles("entrenador")
  @Get(":id")
  async leer(@Param("id", new ZodPipe(IdUsuarioSchema)) id: string): Promise<FichaDeUsuario> {
    return this.usuarios.leer(id)
  }

  /**
   * Corrige los datos de contacto.
   *
   * El cuerpo es una lista blanca estricta: ni rol, ni estado, ni correo. El
   * estado se mueve por sus propias rutas, y que el contrato no tenga forma de
   * expresarlo es denegar por defecto a nivel de tipo.
   */
  @Roles("entrenador")
  @Patch(":id")
  async actualizar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdUsuarioSchema)) id: string,
    @Body(new ZodPipe(CambiosDeUsuarioSchema)) cambios: CambiosDeUsuario,
  ): Promise<FichaDeUsuario> {
    return this.usuarios.actualizar(peticion.usuario?.sub ?? "", id, cambios)
  }

  /** Corrige un correo mal tecleado, solo mientras el perfil sigue pendiente. */
  @Roles("entrenador")
  @Patch(":id/correo")
  async corregirCorreo(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdUsuarioSchema)) id: string,
    @Body(new ZodPipe(CorreoDeUsuarioSchema)) datos: CorreoDeUsuario,
  ): Promise<FichaDeUsuario> {
    return this.usuarios.corregirCorreo(peticion.usuario?.sub ?? "", id, datos.email)
  }

  /** Vuelve a mandar el enlace. El anterior deja de valer en el mismo acto. */
  @Roles("entrenador")
  @Post(":id/reenviar-activacion")
  @HttpCode(HttpStatus.OK)
  async reenviarActivacion(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdUsuarioSchema)) id: string,
  ): Promise<ResultadoDeEnvio> {
    return this.usuarios.reenviarActivacion(peticion.usuario?.sub ?? "", id)
  }

  /**
   * Da de baja. No borra.
   *
   * Es un verbo propio y no un campo dentro de la edicion: son tres escrituras
   * en una transaccion, y aceptar el estado en un cuerpo abriria por contrato la
   * reactivacion a ciegas.
   */
  @Roles("entrenador")
  @Post(":id/desactivar")
  @HttpCode(HttpStatus.OK)
  async desactivar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdUsuarioSchema)) id: string,
  ): Promise<FichaDeUsuario> {
    return this.usuarios.desactivar(peticion.usuario?.sub ?? "", id)
  }

  /** Deshace una baja. Quien nunca activo vuelve a pendiente, no a activo. */
  @Roles("entrenador")
  @Post(":id/reactivar")
  @HttpCode(HttpStatus.OK)
  async reactivar(
    @Req() peticion: PeticionAutenticada,
    @Param("id", new ZodPipe(IdUsuarioSchema)) id: string,
  ): Promise<FichaDeUsuario> {
    return this.usuarios.reactivar(peticion.usuario?.sub ?? "", id)
  }
}
