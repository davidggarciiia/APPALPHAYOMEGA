import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

import * as ts from "typescript"

/**
 * Revisión estática de accesibilidad: no sustituye a TalkBack/VoiceOver (que
 * exigen un dispositivo), pero impide que se cuele un pulsable sin rol, un campo
 * sin etiqueta o un icono sin nombre. Lee el código con el AST de TypeScript.
 */
type Hallazgo = { tipo: string; archivo: string; linea: number }

const ETIQUETAS = ["accessibilityLabel", "aria-label", "accessibilityLabelledBy", "aria-labelledby"]

function atributos(elemento: ts.JsxOpeningLikeElement): string[] {
  return elemento.attributes.properties.filter(ts.isJsxAttribute).map((a) => a.name.getText())
}

/** Un pulsable tiene nombre si contiene texto visible o una expresión (se asume texto). */
function tieneContenido(pulsable: ts.JsxElement): boolean {
  let hay = false
  const visitar = (nodo: ts.Node): void => {
    if (hay || ts.isJsxAttributes(nodo)) return
    if (ts.isJsxText(nodo) && nodo.text.trim() !== "") hay = true
    else if (ts.isJsxExpression(nodo) && nodo.expression !== undefined) hay = true
    else if (
      (ts.isJsxOpeningElement(nodo) || ts.isJsxSelfClosingElement(nodo)) &&
      nodo.tagName.getText() === "Text"
    )
      hay = true
    ts.forEachChild(nodo, visitar)
  }
  pulsable.children.forEach(visitar)
  return hay
}

function revisar(texto: string, archivo: string): { total: number; hallazgos: Hallazgo[] } {
  const fuente = ts.createSourceFile(
    archivo,
    texto,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const hallazgos: Hallazgo[] = []
  let total = 0
  const marcar = (tipo: string, nodo: ts.Node): void => {
    const linea = fuente.getLineAndCharacterOfPosition(nodo.getStart()).line + 1
    hallazgos.push({ tipo, archivo, linea })
  }
  const visitar = (nodo: ts.Node): void => {
    const apertura = ts.isJsxElement(nodo)
      ? nodo.openingElement
      : ts.isJsxSelfClosingElement(nodo)
        ? nodo
        : undefined
    if (apertura !== undefined) {
      const etiqueta = apertura.tagName.getText()
      const nombres = atributos(apertura)
      const conNombre = nombres.some((n) => ETIQUETAS.includes(n))
      if (etiqueta === "Pressable") {
        total++
        if (!nombres.includes("accessibilityRole") && !nombres.includes("role"))
          marcar("Pressable sin rol", nodo)
        if (!conNombre && !(ts.isJsxElement(nodo) && tieneContenido(nodo)))
          marcar("Pressable sin nombre (ni texto ni etiqueta)", nodo)
      } else if (etiqueta === "TextInput") {
        total++
        if (!conNombre && !nombres.includes("placeholder"))
          marcar("TextInput sin etiqueta ni placeholder", nodo)
      } else if (etiqueta === "Image") {
        total++
        const decorativa = ["accessible", "aria-hidden", "alt"].some((n) => nombres.includes(n))
        if (!conNombre && !decorativa) marcar("Image sin etiqueta ni marca decorativa", nodo)
      }
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(fuente)
  return { total, hallazgos }
}

function archivosTsx(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) return entrada.name === "node_modules" ? [] : archivosTsx(ruta)
    return ruta.endsWith(".tsx") && !ruta.endsWith(".spec.tsx") ? [ruta] : []
  })
}

describe("revisión estática de accesibilidad", () => {
  it("detecta un pulsable sin rol, un solo-icono, un campo sin etiqueta y una imagen sin nombre", () => {
    const { total, hallazgos } = revisar(
      `export const X = () => (
        <View>
          <Pressable onPress={() => undefined}><Text>Hola</Text></Pressable>
          <Pressable onPress={() => undefined} accessibilityRole="button"><Icono /></Pressable>
          <TextInput value="a" />
          <Image source={{ uri: "x" }} />
        </View>
      )`,
      "malo.tsx",
    )
    expect(total).toBe(4)
    expect(hallazgos.map((h) => [h.tipo, h.linea])).toEqual([
      ["Pressable sin rol", 3],
      ["Pressable sin nombre (ni texto ni etiqueta)", 4],
      ["TextInput sin etiqueta ni placeholder", 5],
      ["Image sin etiqueta ni marca decorativa", 6],
    ])
  })

  it("acepta un solo-icono con etiqueta, una imagen decorativa y un campo con placeholder", () => {
    const { hallazgos } = revisar(
      `export const X = () => (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar"><Icono /></Pressable>
          <Image source={{ uri: "x" }} accessible={false} />
          <TextInput placeholder="Peso" />
        </View>
      )`,
      "bueno.tsx",
    )
    expect(hallazgos).toEqual([])
  })

  it("la app no tiene pulsables sin rol ni nombre, campos sin etiqueta ni imágenes sin nombre", () => {
    const raiz = join(__dirname, "..")
    const archivos = [join(raiz, "src"), join(raiz, "app")].flatMap(archivosTsx)
    const revisiones = archivos.map((ruta) =>
      revisar(readFileSync(ruta, "utf8"), relative(raiz, ruta).split(sep).join("/")),
    )
    const total = revisiones.reduce((suma, r) => suma + r.total, 0)
    expect(total).toBeGreaterThan(100) // el barrido llega a los elementos reales
    expect(revisiones.flatMap((r) => r.hallazgos)).toEqual([])
  })
})
