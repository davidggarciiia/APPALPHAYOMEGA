import "reflect-metadata"

import { Logger } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"

import { AppModule } from "./app.module.js"
import { cargarEntornoLocal } from "./config/postgres.js"

cargarEntornoLocal()

async function arrancar(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const puerto = Number(process.env.API_PORT ?? 3000)

  await app.listen(puerto)
  new Logger("arranque").log(`API escuchando en http://localhost:${puerto}`)
}

void arrancar()
