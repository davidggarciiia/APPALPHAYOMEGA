import { defineConfig } from "@prisma/config"

/**
 * Configuracion de Prisma para todo el monorepo.
 *
 * Desde la version 7, la URL de conexion ya no vive en schema.prisma. El esquema
 * describe la forma de los datos y este fichero describe contra que base se
 * ejecutan las migraciones. Son dos cosas distintas y tiene sentido separarlas:
 * el esquema se versiona igual para todos, la URL cambia en cada maquina.
 *
 * Prisma 7 tampoco carga el .env solo. Lo cargamos aqui con la funcion nativa de
 * Node, sin dependencias extra.
 */
process.loadEnvFile()

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
