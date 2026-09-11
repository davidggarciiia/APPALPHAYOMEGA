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

function leerVariable(nombre: string): string {
  const valor = process.env[nombre]
  if (valor === undefined || valor === "") {
    throw new Error(`Falta la variable ${nombre}. Copia .env.example a .env y rellena sus valores.`)
  }
  return valor
}

/**
 * La URL se compone aqui a partir de las mismas variables que usa
 * docker-compose, en lugar de escribirse aparte en el .env.
 *
 * Antes estaba duplicada: la contrasena aparecia en POSTGRES_PASSWORD y otra vez
 * incrustada dentro de DATABASE_URL. Quien cambiaba una sola de las dos se
 * llevaba un fallo de conexion que no explicaba su causa. Ahora hay una unica
 * fuente de verdad.
 */
function urlDeConexion(): string {
  const usuario = encodeURIComponent(leerVariable("POSTGRES_USER"))
  const contrasena = encodeURIComponent(leerVariable("POSTGRES_PASSWORD"))
  const baseDeDatos = leerVariable("POSTGRES_DB")
  const host = process.env.POSTGRES_HOST ?? "localhost"
  const puerto = process.env.POSTGRES_PORT ?? "5432"

  return `postgresql://${usuario}:${contrasena}@${host}:${puerto}/${baseDeDatos}?schema=public`
}

export default defineConfig({
  schema: "apps/api/prisma/schema.prisma",
  migrations: {
    path: "apps/api/prisma/migrations",
  },
  datasource: {
    url: urlDeConexion(),
  },
})
