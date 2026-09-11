import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import { urlDeConexion } from "../config/postgres.js"

/**
 * El cliente de Prisma, envuelto como proveedor de Nest para que se inyecte por
 * el contenedor en lugar de instanciarlo a mano en cada servicio.
 *
 * Desde Prisma 7 el cliente no abre la conexion por su cuenta: hay que darle un
 * adaptador de driver explicito. Para Postgres es `PrismaPg`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg(urlDeConexion()) })
  }

  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
