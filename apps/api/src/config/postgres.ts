import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

/**
 * Como se conecta el proyecto a Postgres. Fuente unica de verdad: lo usan tanto
 * el servidor como `prisma.config.ts`, para que la cadena de conexion no este
 * escrita en dos sitios que puedan divergir.
 */

let entornoCargado = false
let directoriosBuscados: string[] = []

/**
 * Busca el fichero .env hacia arriba desde el directorio actual y vuelca sus
 * valores en el entorno.
 *
 * Hay que buscar porque los puntos de entrada arrancan desde sitios distintos:
 * Prisma se ejecuta desde la raiz del monorepo, el servidor desde `apps/api` y
 * Jest desde donde diga su configuracion. Una lista de rutas fijas se rompe en
 * cuanto aparece un cuarto punto de entrada.
 *
 * El fichero se lee y se asigna a mano en lugar de usar `process.loadEnvFile`
 * porque esa funcion escribe en el proceso real, y Jest ejecuta los tests en un
 * contexto aislado con su propio objeto `process`: los valores se cargaban y el
 * test no los veia.
 *
 * Lo que ya venga del entorno tiene prioridad sobre el fichero. En el servidor
 * desplegado no hay ningun .env y esto no falla, simplemente no encuentra nada.
 */
export function cargarEntornoLocal(): void {
  if (entornoCargado) {
    return
  }
  entornoCargado = true
  directoriosBuscados = []

  let directorio = process.cwd()

  for (;;) {
    directoriosBuscados.push(directorio)

    const candidato = resolve(directorio, ".env")
    if (existsSync(candidato)) {
      for (const [clave, valor] of Object.entries(parsearEnv(readFileSync(candidato, "utf8")))) {
        if (process.env[clave] === undefined) {
          process.env[clave] = valor
        }
      }
      return
    }

    const padre = dirname(directorio)
    if (padre === directorio) {
      return
    }
    directorio = padre
  }
}

function parsearEnv(contenido: string): Record<string, string> {
  const valores: Record<string, string> = {}

  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim()
    if (limpia === "" || limpia.startsWith("#")) {
      continue
    }

    const separador = limpia.indexOf("=")
    if (separador === -1) {
      continue
    }

    const clave = limpia.slice(0, separador).trim()
    let valor = limpia.slice(separador + 1).trim()

    const entrecomillado =
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    if (entrecomillado && valor.length >= 2) {
      valor = valor.slice(1, -1)
    }

    valores[clave] = valor
  }

  return valores
}

function leerVariable(nombre: string): string {
  const valor = process.env[nombre]
  if (valor === undefined || valor === "") {
    throw new Error(
      `Falta la variable ${nombre}. Copia .env.example a .env y rellena sus valores. ` +
        `Se busco un .env en: ${directoriosBuscados.join(", ") || "(no se llego a buscar)"}`,
    )
  }
  return valor
}

/**
 * Compone la cadena de conexion a partir de las mismas variables que usa
 * docker-compose.
 *
 * No existe una variable DATABASE_URL a proposito: tenerla escrita aparte
 * duplicaba la contrasena, y cambiar solo una de las dos copias daba un fallo de
 * conexion que no explicaba su causa.
 */
export function urlDeConexion(): string {
  // Se carga aqui y no solo en el arranque porque los puntos de entrada son
  // varios y no todos pasan por main.ts. Cargar al primer uso quita la
  // dependencia de orden, y la bandera evita releer el fichero en cada llamada.
  cargarEntornoLocal()

  const usuario = encodeURIComponent(leerVariable("POSTGRES_USER"))
  const contrasena = encodeURIComponent(leerVariable("POSTGRES_PASSWORD"))
  const baseDeDatos = leerVariable("POSTGRES_DB")
  const host = process.env.POSTGRES_HOST ?? "localhost"
  const puerto = process.env.POSTGRES_PORT ?? "5432"

  return `postgresql://${usuario}:${contrasena}@${host}:${puerto}/${baseDeDatos}?schema=public`
}
