import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

const raiz = join(__dirname, "..")

function fuentes(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) return fuentes(ruta)
    return /\.tsx?$/.test(entrada.name) && !/\.spec\.tsx?$/.test(entrada.name) ? [ruta] : []
  })
}

it("muestra pantallas y listas sin envoltorios de entrada ni cortinas", () => {
  const infracciones = [...fuentes(join(raiz, "app")), ...fuentes(join(raiz, "src"))].flatMap(
    (ruta) => {
      const fuente = readFileSync(ruta, "utf8")
      const archivo = relative(raiz, ruta).split(sep).join("/")
      return /EntradaMarca|CambioDeContenido|Revelado|TransicionPantalla|envolverPantalla|ListaAnimada|useAnimacionLista/.test(
        fuente,
      ) || /\b(?:entering|exiting|layout)\s*=/.test(fuente)
        ? [archivo]
        : []
    },
  )
  expect(infracciones).toEqual([])
})

it("retira los componentes de entrada que ya no tienen consumidores", () => {
  for (const componente of ["entrada-marca", "revelado", "transicion-pantalla", "lista-animada"])
    expect(existsSync(join(raiz, "src", "componentes", `${componente}.tsx`))).toBe(false)
})
