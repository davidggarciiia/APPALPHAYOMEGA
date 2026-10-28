import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("../../test/cobertura.mjs", import.meta.url))

type Fichero = { sentencias: number[]; lineas?: number[] }

/** Informe Istanbul minimo: cada sentencia en su propia linea, sin ramas ni funciones. */
function informe(ruta: string, { sentencias }: Fichero): Record<string, unknown> {
  const statementMap = Object.fromEntries(
    sentencias.map((_, id) => [String(id), { start: { line: id + 1 } }]),
  )
  const s = Object.fromEntries(sentencias.map((veces, id) => [String(id), veces]))
  return { [ruta]: { path: ruta, statementMap, s, f: {}, b: {} } }
}

describe("puerta de cobertura (test/cobertura.mjs --fusionar)", () => {
  let raiz: string
  beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "cobertura-"))
  })
  afterEach(() => {
    rmSync(raiz, { recursive: true, force: true })
  })

  function ejecutar(...ejecuciones: Record<string, unknown>[]): { estado: number; salida: string } {
    const carpetas = ejecuciones.map((contenido) => {
      const carpeta = mkdtempSync(join(raiz, "ejecucion-"))
      writeFileSync(join(carpeta, "coverage-final.json"), JSON.stringify(contenido))
      return carpeta
    })
    const resultado = spawnSync(process.execPath, [script, "--fusionar", ...carpetas], {
      encoding: "utf8",
    })
    return { estado: resultado.status ?? -1, salida: resultado.stdout }
  }

  const servicio = (): string => join(raiz, "src", "a.service.ts")

  it("suma las dos ejecuciones: lo que solo cubre una de ellas cuenta como cubierto", () => {
    const { estado, salida } = ejecutar(
      informe(servicio(), { sentencias: [1, 1, 1, 1, 0] }),
      informe(servicio(), { sentencias: [0, 0, 0, 0, 1] }),
    )
    expect(estado).toBe(0)
    expect(salida).toContain("lines")
    expect(salida).toContain("100.00")
    expect(salida).toContain("Minimo del 80 % cumplido")
  })

  it("falla y señala la métrica cuando el agregado queda por debajo del 80 %", () => {
    const { estado, salida } = ejecutar(informe(servicio(), { sentencias: [1, 0, 0, 0, 0] }))
    expect(estado).toBe(1)
    expect(salida).toContain("FALLA")
    expect(salida).toContain("a.service.ts")
  })

  it("el 80 % exacto cumple y por debajo no", () => {
    expect(ejecutar(informe(servicio(), { sentencias: [1, 1, 1, 1, 0] })).estado).toBe(0)
    expect(ejecutar(informe(servicio(), { sentencias: [1, 1, 1, 0, 0] })).estado).toBe(1)
  })

  it("solo evalúa servicios y guardas; un controlador sin cubrir no cuenta", () => {
    const controlador = join(raiz, "src", "a.controller.ts")
    const { estado, salida } = ejecutar({
      ...informe(servicio(), { sentencias: [1, 1, 1, 1, 1] }),
      ...informe(controlador, { sentencias: [0, 0, 0] }),
    })
    expect(estado).toBe(0)
    expect(salida).toContain("1 servicios y guardas")
  })

  it("incluye las guardas y falla si no encuentra ningún archivo en alcance", () => {
    const guarda = join(raiz, "src", "identity", "x.guard.ts")
    expect(ejecutar(informe(guarda, { sentencias: [1, 1] })).estado).toBe(0)
    const sinAlcance = ejecutar(informe(join(raiz, "src", "main.ts"), { sentencias: [1] }))
    expect(sinAlcance.estado).toBe(1)
    expect(sinAlcance.salida).toContain("No se encontro ningun servicio ni guarda")
  })
})
