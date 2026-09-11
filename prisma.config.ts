import { defineConfig } from "@prisma/config"

import { cargarEntornoLocal, urlDeConexion } from "./apps/api/src/config/postgres"

/**
 * Configuracion de Prisma para todo el monorepo.
 *
 * Desde la version 7, la URL de conexion ya no vive en schema.prisma. El esquema
 * describe la forma de los datos y este fichero describe contra que base se
 * ejecutan las migraciones. Son dos cosas distintas y tiene sentido separarlas:
 * el esquema se versiona igual para todos, la URL cambia en cada maquina.
 *
 * La cadena de conexion se compone en `apps/api/src/config/postgres.ts`, que es
 * el mismo codigo que usa el servidor. Asi no hay dos versiones de la misma
 * logica que puedan separarse con el tiempo.
 */
cargarEntornoLocal()

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
  },
  datasource: {
    url: urlDeConexion(),
  },
})
