import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { leerVariable, leerVariableOpcional } from "../config/entorno.js"

import { AuthController } from "./auth.controller.js"
import { AuthService } from "./auth.service.js"

const EXPIRACION_POR_DEFECTO_SEGUNDOS = 900

/**
 * Modulo `identity` del mapa de capacidades: quien entra y que puede tocar.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      // Perezoso a proposito: leer el secreto al construir el modulo y no al
      // importar el fichero permite que los tests preparen el entorno antes.
      useFactory: () => ({
        secret: leerVariable("JWT_SECRET"),
        signOptions: {
          // En segundos y no en texto tipo "15m": el tipo de la libreria solo
          // admite un puñado de formatos de texto concretos, y un numero no deja
          // lugar a interpretacion.
          expiresIn: Number(
            leerVariableOpcional(
              "JWT_EXPIRACION_ACCESO_SEGUNDOS",
              String(EXPIRACION_POR_DEFECTO_SEGUNDOS),
            ),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class IdentityModule {}
