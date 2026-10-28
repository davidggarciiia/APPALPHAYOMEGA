import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

import * as ts from "typescript"

/**
 * En web, react-native-web avisa en desarrollo de «Image: style.resizeMode is
 * deprecated. Please use props.resizeMode» (y lo mismo con tintColor). Jest no
 * carga react-native-web, así que ese aviso no salta en las pruebas: esta guarda
 * lo detecta leyendo el código. Resuelve los `StyleSheet.create` del mismo
 * archivo para ver qué claves lleva el estilo que recibe cada <Image>.
 */
const PROHIBIDAS = ["resizeMode", "tintColor"]

function clavesPorHoja(fuente: ts.SourceFile): Map<string, Map<string, Set<string>>> {
  const hojas = new Map<string, Map<string, Set<string>>>()
  const visitar = (nodo: ts.Node): void => {
    if (
      ts.isVariableDeclaration(nodo) &&
      ts.isIdentifier(nodo.name) &&
      nodo.initializer !== undefined &&
      ts.isCallExpression(nodo.initializer) &&
      nodo.initializer.expression.getText() === "StyleSheet.create" &&
      nodo.initializer.arguments[0] !== undefined &&
      ts.isObjectLiteralExpression(nodo.initializer.arguments[0])
    ) {
      const estilos = new Map<string, Set<string>>()
      for (const propiedad of nodo.initializer.arguments[0].properties) {
        if (
          !ts.isPropertyAssignment(propiedad) ||
          !ts.isObjectLiteralExpression(propiedad.initializer)
        )
          continue
        estilos.set(
          propiedad.name.getText(),
          new Set(propiedad.initializer.properties.map((p) => p.name?.getText() ?? "")),
        )
      }
      hojas.set(nodo.name.text, estilos)
    }
    ts.forEachChild(nodo, visitar)
  }
  visitar(fuente)
  return hojas
}

function infracciones(texto: string, archivo: string): string[] {
  const fuente = ts.createSourceFile(
    archivo,
    texto,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const hojas = clavesPorHoja(fuente)
  const encontradas: string[] = []

  const revisarEstilo = (expresion: ts.Node, imagen: ts.Node): void => {
    const marcar = (clave: string): void => {
      const linea = fuente.getLineAndCharacterOfPosition(imagen.getStart()).line + 1
      encontradas.push(`${archivo}:${String(linea)} style.${clave}`)
    }
    const visitar = (nodo: ts.Node): void => {
      if (ts.isPropertyAccessExpression(nodo) && ts.isIdentifier(nodo.expression)) {
        const claves = hojas.get(nodo.expression.text)?.get(nodo.name.text)
        for (const prohibida of PROHIBIDAS) if (claves?.has(prohibida)) marcar(prohibida)
      } else if (ts.isObjectLiteralExpression(nodo)) {
        for (const p of nodo.properties)
          if (PROHIBIDAS.includes(p.name?.getText() ?? "")) marcar(p.name?.getText() ?? "")
      }
      ts.forEachChild(nodo, visitar)
    }
    visitar(expresion)
  }

  const visitarArbol = (nodo: ts.Node): void => {
    const apertura = ts.isJsxElement(nodo)
      ? nodo.openingElement
      : ts.isJsxSelfClosingElement(nodo)
        ? nodo
        : undefined
    if (apertura?.tagName.getText() === "Image")
      for (const atributo of apertura.attributes.properties)
        if (
          ts.isJsxAttribute(atributo) &&
          atributo.name.getText() === "style" &&
          atributo.initializer !== undefined
        )
          revisarEstilo(atributo.initializer, nodo)
    ts.forEachChild(nodo, visitarArbol)
  }
  visitarArbol(fuente)
  return encontradas
}

function archivosTsx(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name)
    if (entrada.isDirectory()) return entrada.name === "node_modules" ? [] : archivosTsx(ruta)
    return ruta.endsWith(".tsx") && !ruta.endsWith(".spec.tsx") ? [ruta] : []
  })
}

describe("props de Image", () => {
  it("detecta resizeMode y tintColor puestos en el estilo, por hoja o en línea", () => {
    const fuente = `
      const s = StyleSheet.create({
        malo: { width: 1, resizeMode: "contain" },
        tenue: { tintColor: "red" },
        bueno: { width: 2 },
      })
      export const X = () => (
        <View>
          <Image source={a} style={s.malo} />
          <Image source={a} style={[s.bueno, activo && s.tenue]} />
          <Image source={a} style={{ resizeMode: "cover" }} />
          <Image source={a} style={s.bueno} resizeMode="contain" tintColor="red" />
        </View>
      )`
    expect(infracciones(fuente, "x.tsx")).toEqual([
      "x.tsx:9 style.resizeMode",
      "x.tsx:10 style.tintColor",
      "x.tsx:11 style.resizeMode",
    ])
  })

  it("ninguna pantalla pasa resizeMode ni tintColor por el estilo de un Image", () => {
    const raiz = join(__dirname, "..")
    const archivos = [join(raiz, "src"), join(raiz, "app")].flatMap(archivosTsx)
    const todas = archivos.flatMap((ruta) =>
      infracciones(readFileSync(ruta, "utf8"), relative(raiz, ruta).split(sep).join("/")),
    )
    expect(todas).toEqual([])
  })
})
