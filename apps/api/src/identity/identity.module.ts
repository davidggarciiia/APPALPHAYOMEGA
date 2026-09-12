import { Global, Module } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { JwtModule } from "@nestjs/jwt"

import { leerVariable, leerVariableOpcional } from "../config/entorno.js"

import { AuthController } from "./auth.controller.js"
import { AuthService } from "./auth.service.js"
import { AutenticacionGuard } from "./autenticacion.guard.js"

const EXPIRACION_POR_DEFECTO_SEGUNDOS = 900

/**
 * Modulo `identity` del mapa de capacidades: quien entra y que puede tocar.
 *
 * Global porque registra el guard que protege toda la aplicacion y porque el
 * resto de modulos necesitaran comprobar identidad.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      // Perezoso a proposito: leer el secreto al construir el modulo y no al
      // importar el fichero permite que los tests preparen el entorno antes.
      useFactory: () => ({
        secret: leerVariable("JWT_SECRET"),
        signOptions: {
          // En segundos y no en texto tipo "15m": el tipo de la libreria solo
          // admite un punado de formatos de texto concretos, y un numero no deja
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
  providers: [
    AuthService,
    // Registrado asi, el guard se aplica a TODA ruta de la aplicacion, incluidas
    // las de modulos que todavia no existen. Es la pieza que hace que cerrar sea
    // el comportamiento por defecto y abrir requiera escribirlo.
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class IdentityModule {}
