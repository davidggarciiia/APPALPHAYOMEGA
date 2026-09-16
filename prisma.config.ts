import { defineConfig } from "@prisma/config"

import { cargarEntornoLocal } from "./apps/api/src/config/entorno"
import { urlDeConexion } from "./apps/api/src/config/postgres"

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

/**
 * La URL se calcula sin reventar si faltan variables.
 *
 * Este fichero se carga en TODOS los comandos de Prisma, incluido `generate`,
 * que no necesita ninguna base de datos. Si aqui se lanzara una excepcion, un
 * clon limpio sin `.env` no podria ni generar el cliente, y por tanto no podria
 * compilar nada. Los comandos que si necesitan la base fallaran despues, con el
 * mensaje de Prisma.
 */
function urlSiEsPosible(): string | undefined {
  try {
    return urlDeConexion()
  } catch {
    console.warn(
      "[prisma] Sin variables de conexion. `generate` funciona igual; " +
        "`migrate` y `studio` necesitan un .env. Copia .env.example.",
    )
    return undefined
  }
}

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
    // El seed se compila antes de ejecutarse. El modo de Node que quita tipos
    // sobre la marcha no sirve aqui: no resuelve un import terminado en .js
    // contra un fichero .ts, que es como NodeNext obliga a escribirlos.
    seed: "npm run seed --workspace apps/api",
  },
  datasource: {
    url: urlSiEsPosible(),
  },
})
