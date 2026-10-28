import { leerEnteroPositivo, leerVariable, leerVariableOpcional } from "./entorno.js"
import { isAbsolute } from "node:path"
import type { PoolConfig } from "pg"

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
export function urlDeConexion(destino: "aplicacion" | "migraciones" = "aplicacion"): string {
  const usuario = encodeURIComponent(leerVariable("POSTGRES_USER"))
  const contrasena = encodeURIComponent(leerVariable("POSTGRES_PASSWORD"))
  const baseDeDatos = encodeURIComponent(leerVariable("POSTGRES_DB"))
  const host = leerVariableOpcional("POSTGRES_HOST", "localhost")
  const puerto = leerVariableOpcional("POSTGRES_PORT", "5432")
  const modo = leerVariableOpcional("PGSSLMODE", "disable")
  if (leerVariableOpcional("NODE_ENV", "") === "production" && modo !== "verify-full")
    throw new Error("En producción define PGSSLMODE=verify-full para verificar PostgreSQL")
  if (modo !== "verify-full" && modo !== "disable")
    throw new Error("PGSSLMODE debe ser verify-full (producción) o disable (desarrollo)")

  const url = new URL(`postgresql://${usuario}:${contrasena}@${host}:${puerto}/${baseDeDatos}`)
  url.searchParams.set("schema", "public")
  // El motor de Migrate usa require+strict; pg usa verify-full sin rebajar la CA ni el nombre.
  url.searchParams.set(
    "sslmode",
    modo === "verify-full" && destino === "migraciones" ? "require" : modo,
  )
  if (modo === "verify-full") {
    if (destino === "migraciones") url.searchParams.set("sslaccept", "strict")
    const ca = leerVariableOpcional("PGSSLROOTCERT", "")
    if (ca !== "") {
      if (!isAbsolute(ca)) throw new Error("PGSSLROOTCERT debe ser una ruta absoluta")
      url.searchParams.set(destino === "migraciones" ? "sslcert" : "sslrootcert", ca)
    }
  }
  return url.toString()
}

/**
 * Configuracion del pool de la aplicacion: la misma conexion de `urlDeConexion`
 * mas plazos, para que una base que no responde no retenga peticiones.
 *
 * `statement_timeout` lo aplica el servidor, que cancela la consulta y libera la
 * conexion. `query_timeout` es el respaldo del cliente por si el servidor ya no
 * contesta, por eso va 5 s por encima. Los scripts de carga (seed, catalogo) usan
 * la URL sin plazos a proposito: sus consultas largas son esperadas.
 */
export function opcionesDelPool(): PoolConfig {
  const consultaMs = leerEnteroPositivo("PG_QUERY_TIMEOUT_MS", 30_000)
  return {
    connectionString: urlDeConexion(),
    connectionTimeoutMillis: leerEnteroPositivo("PG_CONNECT_TIMEOUT_MS", 10_000),
    idleTimeoutMillis: leerEnteroPositivo("PG_IDLE_TIMEOUT_MS", 30_000),
    max: leerEnteroPositivo("PG_POOL_MAX", 10),
    statement_timeout: consultaMs,
    query_timeout: consultaMs + 5_000,
  }
}
