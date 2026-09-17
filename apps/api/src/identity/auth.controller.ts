import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from "@nestjs/common"
import {
  ActivacionSchema,
  CredencialesSchema,
  PeticionRefrescoSchema,
  SolicitudRecuperacionSchema,
  RestablecerContrasenaSchema,
  type Activacion,
  type Credenciales,
  type PeticionRefresco,
  type Sesion,
  type SolicitudRecuperacion,
  type RestablecerContrasena,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import { ActivacionService } from "./activacion.service.js"
import { AuthService } from "./auth.service.js"
import { Publico } from "./publico.decorator.js"
import { RecuperacionService } from "./recuperacion.service.js"

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly activacion: ActivacionService,
    private readonly recuperacion: RecuperacionService,
  ) {}

  /**
   * Un login correcto no crea nada, asi que responde 200 y no 201.
   */
  @Publico()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async iniciarSesion(
    @Body(new ZodPipe(CredencialesSchema)) credenciales: Credenciales,
    @Ip() origen: string,
  ): Promise<Sesion> {
    return this.auth.iniciarSesion(credenciales, origen)
  }

  /**
   * Publico por definicion: quien activa su cuenta todavia no tiene sesion.
   * La autorizacion la da el propio enlace, que llego a su correo.
   */
  @Publico()
  @Post("activar")
  @HttpCode(HttpStatus.NO_CONTENT)
  async activar(@Body(new ZodPipe(ActivacionSchema)) datos: Activacion): Promise<void> {
    await this.activacion.activar(datos.token, datos.contrasena)
  }

  @Publico()
  @Post("recuperar")
  @HttpCode(HttpStatus.NO_CONTENT)
  async solicitarRecuperacion(
    @Body(new ZodPipe(SolicitudRecuperacionSchema)) datos: SolicitudRecuperacion,
    @Ip() origen: string,
  ): Promise<void> {
    await this.recuperacion.solicitar(datos.email, origen)
  }

  @Publico()
  @Post("restablecer")
  @HttpCode(HttpStatus.NO_CONTENT)
  async restablecerContrasena(
    @Body(new ZodPipe(RestablecerContrasenaSchema)) datos: RestablecerContrasena,
    @Ip() origen: string,
  ): Promise<void> {
    await this.recuperacion.restablecer(datos.token, datos.contrasena, origen)
  }

  /**
   * Publico porque quien lo llama tiene, por definicion, el token de acceso
   * caducado. La autorizacion aqui la da el propio token de refresco.
   */
  @Publico()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refrescar(
    @Body(new ZodPipe(PeticionRefrescoSchema)) cuerpo: PeticionRefresco,
  ): Promise<Sesion> {
    return this.auth.refrescar(cuerpo.tokenRefresco)
  }

  /**
   * Tambien publico, y por el mismo motivo: cerrar sesion tiene que funcionar
   * aunque el token de acceso ya haya caducado. Lo que se presenta es el token
   * de refresco, y solo revoca ese.
   */
  @Publico()
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async cerrarSesion(
    @Body(new ZodPipe(PeticionRefrescoSchema)) cuerpo: PeticionRefresco,
  ): Promise<void> {
    await this.auth.cerrarSesion(cuerpo.tokenRefresco)
  }
}
