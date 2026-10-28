/**
 * Puerta de cobertura de la API (SPEC.md: 80 % en servicios y guardas).
 *
 * La logica de los servicios y los permisos se ejercita sobre todo con los E2E y
 * su base de datos real, asi que ninguna de las dos ejecuciones basta por si sola
 * (solo con las unitarias se queda en torno al 50 %). Este comando ejecuta ambas,
 * suma los contadores de cada archivo y exige el minimo sobre el agregado de
 * `*.service.ts` y `*.guard.ts`. Los archivos sin ningun test cuentan a cero.
 *
 *   npm run test:cobertura --workspace apps/api            unitarias + E2E + puerta
 *   node test/cobertura.mjs --fusionar <carpeta> <carpeta> solo suma y evalua
 *
 * Los E2E exigen una base de pruebas: define POSTGRES_DB con "e2e" en el nombre.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, rmSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const UMBRAL = 80
const METRICAS = ["lines", "statements", "functions", "branches"]
const EN_ALCANCE = /[\\/]src[\\/].*\.(service|guard)\.ts$/

function fusionar(mapas) {
  const total = {}
  for (const mapa of mapas) {
    for (const [ruta, cobertura] of Object.entries(mapa)) {
      const clave = resolve(ruta)
      const previo = total[clave]
      if (previo === undefined) {
        total[clave] = JSON.parse(JSON.stringify(cobertura))
        continue
      }
      for (const id of Object.keys(cobertura.s))
        previo.s[id] = (previo.s[id] ?? 0) + cobertura.s[id]
      for (const id of Object.keys(cobertura.f))
        previo.f[id] = (previo.f[id] ?? 0) + cobertura.f[id]
      for (const id of Object.keys(cobertura.b))
        previo.b[id] = cobertura.b[id].map((n, i) => n + (previo.b[id]?.[i] ?? 0))
    }
  }
  return total
}

const contar = (valores) => ({
  total: valores.length,
  cubiertos: valores.filter((n) => n > 0).length,
})

function resumir(cobertura) {
  // Una linea esta cubierta si lo esta alguna sentencia que empieza en ella.
  const lineas = new Map()
  for (const [id, veces] of Object.entries(cobertura.s)) {
    const linea = cobertura.statementMap[id].start.line
    lineas.set(linea, (lineas.get(linea) ?? 0) + veces)
  }
  return {
    lines: contar([...lineas.values()]),
    statements: contar(Object.values(cobertura.s)),
    functions: contar(Object.values(cobertura.f)),
    branches: contar(Object.values(cobertura.b).flat()),
  }
}

const porcentaje = ({ total, cubiertos }) => (total === 0 ? 100 : (cubiertos / total) * 100)

function evaluar(fusionada, umbral = UMBRAL) {
  const archivos = Object.entries(fusionada).filter(([ruta]) => EN_ALCANCE.test(ruta))
  const agregado = Object.fromEntries(METRICAS.map((m) => [m, { total: 0, cubiertos: 0 }]))
  const bajos = []
  for (const [ruta, cobertura] of archivos) {
    const resumen = resumir(cobertura)
    for (const m of METRICAS) {
      agregado[m].total += resumen[m].total
      agregado[m].cubiertos += resumen[m].cubiertos
    }
    if (porcentaje(resumen.lines) < umbral) bajos.push([ruta, porcentaje(resumen.lines)])
  }
  const porMetrica = Object.fromEntries(METRICAS.map((m) => [m, porcentaje(agregado[m])]))
  const falla = METRICAS.filter((m) => porMetrica[m] < umbral)
  return { archivos: archivos.length, porMetrica, falla, bajos }
}

function informar(resultado, umbral = UMBRAL) {
  console.log(`\nCobertura fusionada de ${String(resultado.archivos)} servicios y guardas:`)
  for (const m of METRICAS) {
    const marca = resultado.falla.includes(m) ? "FALLA" : "ok"
    console.log(`  ${m.padEnd(11)} ${resultado.porMetrica[m].toFixed(2).padStart(6)} %  ${marca}`)
  }
  if (resultado.bajos.length > 0) {
    console.log(`\nArchivos con menos de ${String(umbral)} % de lineas (informativo):`)
    for (const [ruta, valor] of resultado.bajos.sort((a, b) => a[1] - b[1]))
      console.log(`  ${valor.toFixed(2).padStart(6)} %  ${ruta.split(/[\\/]src[\\/]/)[1]}`)
  }
  if (resultado.archivos === 0) console.log("\nNo se encontro ningun servicio ni guarda.")
  console.log(
    resultado.falla.length === 0 && resultado.archivos > 0
      ? `\nMinimo del ${String(umbral)} % cumplido.`
      : `\nPor debajo del minimo del ${String(umbral)} %: ${resultado.falla.join(", ") || "sin archivos"}.`,
  )
}

function evaluarCarpetas(carpetas) {
  const mapas = carpetas.map((carpeta) =>
    JSON.parse(readFileSync(join(carpeta, "coverage-final.json"), "utf8")),
  )
  const resultado = evaluar(fusionar(mapas))
  informar(resultado)
  return resultado.falla.length === 0 && resultado.archivos > 0 ? 0 : 1
}

function ejecutarJest(raiz, argumentos) {
  const resultado = spawnSync(
    process.execPath,
    [join(raiz, "test", "ejecutar-jest.mjs"), ...argumentos],
    { cwd: raiz, stdio: "inherit" },
  )
  if (resultado.error) throw resultado.error
  return resultado.status ?? 1
}

function main(argumentos) {
  if (argumentos[0] === "--fusionar")
    return evaluarCarpetas(argumentos.slice(1).map((c) => resolve(c)))

  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..")
  const unitarias = join(raiz, "coverage", "unitarias")
  const e2e = join(raiz, "coverage", "e2e")
  for (const carpeta of [unitarias, e2e]) rmSync(carpeta, { recursive: true, force: true })
  const comunes = ["--coverage", "--coverageReporters=json"]

  const estadoUnitarias = ejecutarJest(raiz, [
    "--config",
    "jest.config.mjs",
    ...comunes,
    // Ruta absoluta: la config unitaria tiene rootDir "src" y una relativa acabaria dentro.
    `--coverageDirectory=${unitarias}`,
  ])
  if (estadoUnitarias !== 0) return estadoUnitarias
  const estadoE2e = ejecutarJest(raiz, [
    "--config",
    "test/jest-e2e.json",
    "--runInBand",
    ...comunes,
    `--coverageDirectory=${e2e}`,
    "--collectCoverageFrom=src/**/*.service.ts",
    "--collectCoverageFrom=src/**/*.guard.ts",
  ])
  if (estadoE2e !== 0) return estadoE2e
  if (![unitarias, e2e].every((c) => existsSync(join(c, "coverage-final.json")))) {
    console.error("Falta un informe de cobertura; no se puede evaluar el minimo.")
    return 1
  }
  return evaluarCarpetas([unitarias, e2e])
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exit(main(process.argv.slice(2)))
