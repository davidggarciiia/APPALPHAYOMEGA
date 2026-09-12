import { Module } from "@nestjs/common"

import { IdentityModule } from "./identity/identity.module.js"
import { PrismaModule } from "./prisma/prisma.module.js"
import { SaludModule } from "./salud/salud.module.js"

/**
 * Raiz de la aplicacion. Cada modulo del mapa de capacidades se cuelga de aqui.
 */
@Module({
  imports: [PrismaModule, IdentityModule, SaludModule],
})
export class AppModule {}
