import { leerVariable, leerVariableOpcional } from "./entorno.js"

/**
 * Como se conecta el proyecto a Postgres. Fuente unica de verdad: lo usan tanto
 * el servidor como `prisma.config.ts`, para que la cadena de conexion no este
 * escrita en dos sitios que puedan divergir.
 */

/**
 * Compone la cadena de conexion a partir de las mismas variables que usa
 * docker-compose.
 *
 * No existe una variable DATABASE_URL a proposito: tenerla escrita aparte
 * duplicaba la contrasena, y cambiar solo una de las dos copias daba un fallo de
 * conexion que no explicaba su causa.
 */
export function urlDeConexion(): string {
  const usuario = encodeURIComponent(leerVariable("POSTGRES_USER"))
  const contrasena = encodeURIComponent(leerVariable("POSTGRES_PASSWORD"))
  const baseDeDatos = leerVariable("POSTGRES_DB")
  const host = leerVariableOpcional("POSTGRES_HOST", "localhost")
  const puerto = leerVariableOpcional("POSTGRES_PORT", "5432")

  return `postgresql://${usuario}:${contrasena}@${host}:${puerto}/${baseDeDatos}?schema=public`
}
