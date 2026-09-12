import { Module } from "@nestjs/common"

import { CorreoModule } from "./correo/correo.module.js"
import { IdentityModule } from "./identity/identity.module.js"
import { PrismaModule } from "./prisma/prisma.module.js"
import { SaludModule } from "./salud/salud.module.js"

/**
 * Raiz de la aplicacion. Cada modulo del mapa de capacidades se cuelga de aqui.
 */
@Module({
  imports: [PrismaModule, CorreoModule, IdentityModule, SaludModule],
})
export class AppModule {}
