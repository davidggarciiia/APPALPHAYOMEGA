import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

/**
 * Lectura de configuracion del entorno. Lo usan el servidor, los tests y la
 * configuracion de Prisma, que arrancan desde directorios distintos.
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

/**
 * Lee una variable obligatoria. Carga el fichero al primer uso, porque los
 * puntos de entrada son varios y no todos pasan por main.ts.
 */
export function leerVariable(nombre: string): string {
  cargarEntornoLocal()

  const valor = process.env[nombre]
  if (valor === undefined || valor === "") {
    throw new Error(
      `Falta la variable ${nombre}. Copia .env.example a .env y rellena sus valores. ` +
        `Se busco un .env en: ${directoriosBuscados.join(", ") || "(no se llego a buscar)"}`,
    )
  }
  return valor
}

/** Lee una variable opcional con valor por defecto. */
export function leerVariableOpcional(nombre: string, porDefecto: string): string {
  cargarEntornoLocal()
  const valor = process.env[nombre]
  return valor === undefined || valor === "" ? porDefecto : valor
}
