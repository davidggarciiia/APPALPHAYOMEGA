import { Body, Controller, HttpCode, HttpStatus, Ip, Post } from "@nestjs/common"
import {
  CredencialesSchema,
  PeticionRefrescoSchema,
  type Credenciales,
  type PeticionRefresco,
  type Sesion,
} from "@alpha-omega/shared"

import { ZodPipe } from "../comun/zod.pipe.js"

import { AuthService } from "./auth.service.js"
import { Publico } from "./publico.decorator.js"

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
