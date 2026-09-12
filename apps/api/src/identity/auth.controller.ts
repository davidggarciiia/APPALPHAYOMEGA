import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common"
import { CredencialesSchema, type Credenciales, type Sesion } from "@alpha-omega/shared"

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
  ): Promise<Sesion> {
    return this.auth.iniciarSesion(credenciales)
  }
}
