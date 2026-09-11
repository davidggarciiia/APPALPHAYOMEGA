import { Global, Module } from "@nestjs/common"

import { PrismaService } from "./prisma.service.js"

/**
 * Global porque practicamente todos los modulos del mapa de capacidades van a
 * necesitar la base de datos. Marcarlo asi evita importarlo en cada uno.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
