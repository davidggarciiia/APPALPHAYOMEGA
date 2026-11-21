import { fireEvent, render, screen } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as ts from "typescript"

import { tema } from "../tema"
import { FilaComparativa, TarjetaComparativas, TarjetaPeso } from "./tarjetas-progreso"

const ventana = Dimensions.get("window")
afterEach(() => Dimensions.set({ window: ventana }))

it.each([360, 390])(
  "destaca el peso en %s px con la comparación y el cambio real",
  async (width) => {
    Dimensions.set({ window: { ...ventana, width } })
    const abrir = jest.fn()
    await render(
      <TarjetaPeso
        etiqueta="Peso en ayunas"
        inicial={111.6}
        actual={104.2}
        unidad="kg"
        sentido="favorable"
        alPulsar={abrir}
      />,
    )
    expect(screen.getByText("Peso en ayunas")).toBeOnTheScreen()
    expect(screen.getByText("111,6")).toBeOnTheScreen()
    expect(screen.getByText("104,2")).toBeOnTheScreen()
    expect(screen.getByText("−7,4 kg")).toHaveStyle({ color: tema.exito })
    expect(screen.getByTestId("barra-peso-inicial", { includeHiddenElements: true })).toHaveStyle({
      width: "100%",
    })
    expect(
      screen.getByTestId("barra-peso-actual", { includeHiddenElements: true }).props.style,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: expect.stringMatching(/^93\./) })]),
    )
    await fireEvent.press(
      screen.getByRole("button", { name: /Peso en ayunas.*111,6.*104,2.*−7,4 kg/ }),
    )
    expect(abrir).toHaveBeenCalledTimes(1)
  },
)

it("no inventa el valor inicial ni el cambio cuando solo hay una medición", async () => {
  await render(<TarjetaPeso etiqueta="Peso" inicial={null} actual={80} unidad="kg" />)
  expect(screen.getByText("80")).toBeOnTheScreen()
  expect(screen.queryByTestId("barra-peso-inicial")).toBeNull()
  expect(screen.queryByText(/^[+−]/)).toBeNull()
})

it("agrupa filas comparables y conserva la acción y unidades de cada una", async () => {
  const abrir = jest.fn()
  await render(
    <TarjetaComparativas
      filas={[
        {
          id: "cintura",
          nombre: "Cintura",
          inicial: 118,
          actual: 111.5,
          unidad: "cm",
          alPulsar: abrir,
        },
        { id: "plancha", nombre: "Plancha", inicial: 45, actual: 80, unidad: "s" },
      ]}
    />,
  )
  expect(screen.getByText("Cintura")).toBeOnTheScreen()
  expect(screen.getByText(/^118/)).toBeOnTheScreen()
  expect(screen.getByText("111,5 cm")).toBeOnTheScreen()
  expect(screen.getByText("−6,5 cm")).toBeOnTheScreen()
  expect(screen.getByText("80 s")).toBeOnTheScreen()
  expect(screen.getByText("+35 s")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: /Cintura.*118.*111,5 cm.*−6,5 cm/ }))
  expect(abrir).toHaveBeenCalledTimes(1)
})

it("mantiene barras acotadas para ceros y valores negativos", async () => {
  await render(
    <TarjetaComparativas
      filas={[{ id: "cero", nombre: "Ejemplo", inicial: 0, actual: 0, unidad: "kg" }]}
    />,
  )
  expect(screen.getByTestId("barra-cero-inicial", { includeHiddenElements: true })).toHaveStyle({
    width: "0%",
  })
  expect(screen.getByTestId("barra-cero-actual", { includeHiddenElements: true })).toHaveStyle({
    width: "0%",
  })
})

it("permite renderizar una fila independiente con bordes de grupo para listas virtualizadas", async () => {
  await render(
    <FilaComparativa
      fila={{ id: "press", nombre: "Press banca", inicial: 80, actual: 95, unidad: "kg" }}
      posicion="ultima"
    />,
  )
  expect(screen.getByText("Press banca")).toBeOnTheScreen()
  expect(screen.getByText("95 kg")).toBeOnTheScreen()
  expect(screen.getByTestId("comparativa-press")).toHaveStyle({
    backgroundColor: tema.superficie,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  })
})

it("compara porcentajes con anillos y un único anuncio accesible", async () => {
  const abrir = jest.fn()
  await render(
    <FilaComparativa
      fila={{
        id: "grasa",
        nombre: "Grasa corporal",
        inicial: 31.2,
        actual: 28.4,
        unidad: "%",
        representacion: "anillos",
        alPulsar: abrir,
      }}
    />,
  )
  expect(
    screen.getByTestId("anillo-grasa-inicial", { includeHiddenElements: true }),
  ).toBeOnTheScreen()
  expect(
    screen.getByTestId("anillo-grasa-actual", { includeHiddenElements: true }),
  ).toBeOnTheScreen()
  await fireEvent.press(
    screen.getByRole("button", { name: /Grasa corporal.*31,2.*28,4 %.*−2,8 %/ }),
  )
  expect(abrir).toHaveBeenCalledTimes(1)
})

it("usa una rotación SVG centrada compatible con web y nativo sin origin", () => {
  const archivo = join(__dirname, "tarjetas-progreso.tsx")
  const fuente = ts.createSourceFile(
    archivo,
    readFileSync(archivo, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const circulos: ts.JsxSelfClosingElement[] = []
  const visitar = (nodo: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(nodo) && nodo.tagName.getText(fuente) === "Circle")
      circulos.push(nodo)
    ts.forEachChild(nodo, visitar)
  }
  visitar(fuente)
  const progreso = circulos.find((circulo) =>
    circulo.attributes.properties.some(
      (p) => ts.isJsxAttribute(p) && p.name.getText(fuente) === "strokeDashoffset",
    ),
  )
  expect(progreso).toBeDefined()
  const atributos = progreso!.attributes.properties.filter(ts.isJsxAttribute)
  expect(
    atributos
      .map((a) => a.name.getText(fuente))
      .filter((nombre) => ["origin", "originX", "originY", "rotation"].includes(nombre)),
  ).toEqual([])
  const transformacion = atributos.find((a) => a.name.getText(fuente) === "transform")
  expect(
    transformacion?.initializer &&
      ts.isStringLiteral(transformacion.initializer) &&
      transformacion.initializer.text,
  ).toBe("rotate(-90 30 30)")
})

it("no muestra anillo inicial ni fabrica comparación con una sola toma", async () => {
  await render(
    <FilaComparativa
      fila={{
        id: "grasa",
        nombre: "Grasa",
        inicial: null,
        actual: 20,
        unidad: "%",
        representacion: "anillos",
      }}
    />,
  )
  expect(screen.queryByTestId("anillo-grasa-inicial", { includeHiddenElements: true })).toBeNull()
  expect(
    screen.getByTestId("anillo-grasa-actual", { includeHiddenElements: true }),
  ).toBeOnTheScreen()
})

it("anuncia también el contexto de la comparación cuando se aporta", async () => {
  await render(
    <FilaComparativa
      fila={{
        id: "press",
        nombre: "Press banca",
        inicial: 60,
        actual: 80,
        unidad: "kg",
        descripcion: "Primer registro disponible; 8 repeticiones",
        alPulsar: jest.fn(),
      }}
    />,
  )
  expect(
    screen.getByRole("button", {
      name: /Press banca.*60.*80 kg.*\+20 kg.*Primer registro disponible; 8 repeticiones/,
    }),
  ).toBeOnTheScreen()
})

it("anuncia la fecha y el origen del peso cuando se aportan", async () => {
  await render(
    <TarjetaPeso
      etiqueta="Peso"
      inicial={90}
      actual={82}
      unidad="kg"
      descripcion="Medidas del 1 de enero al 1 de octubre"
      alPulsar={jest.fn()}
    />,
  )
  expect(
    screen.getByRole("button", {
      name: /Peso.*90.*82 kg.*−8 kg.*Medidas del 1 de enero al 1 de octubre/,
    }),
  ).toBeOnTheScreen()
})

it("muestra y anuncia las repeticiones de ambas marcas de fuerza", async () => {
  await render(
    <FilaComparativa
      fila={{
        id: "press",
        nombre: "Press banca",
        inicial: 60,
        actual: 80,
        unidad: "kg",
        repeticionesInicial: 10,
        repeticionesActual: 2,
        alPulsar: jest.fn(),
      }}
    />,
  )
  expect(screen.getByText(/60×10\s*→/)).toBeOnTheScreen()
  expect(screen.getByText("80 kg×2")).toBeOnTheScreen()
  expect(
    screen.getByRole("button", {
      name: /Press banca.*60 kg.*10 repeticiones.*80 kg.*2 repeticiones.*\+20 kg/,
    }),
  ).toBeOnTheScreen()
})

it("muestra repeticiones actuales sin inventar una marca inicial", async () => {
  await render(
    <FilaComparativa
      fila={{
        id: "press",
        nombre: "Press banca",
        inicial: null,
        actual: 80,
        unidad: "kg",
        repeticionesInicial: null,
        repeticionesActual: 1,
        alPulsar: jest.fn(),
      }}
    />,
  )
  expect(screen.getByText("80 kg×1")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /Press banca.*80 kg.*1 repetición/ })).toBeOnTheScreen()
  expect(screen.queryByText(/→/)).toBeNull()
})

it("representa el aumento con una barra segmentada como la referencia de Claude", async () => {
  await render(
    <FilaComparativa
      fila={{
        id: "press",
        nombre: "Press banca",
        inicial: 60,
        actual: 80,
        unidad: "kg",
        representacion: "tramo",
        alPulsar: jest.fn(),
      }}
    />,
  )
  expect(screen.getByTestId("tramo-press-base", { includeHiddenElements: true })).toHaveStyle({
    width: "75%",
  })
  expect(screen.getByTestId("tramo-press-aumento", { includeHiddenElements: true })).toHaveStyle({
    width: "25%",
    backgroundColor: tema.acento,
  })
  expect(screen.queryByTestId("barra-press-inicial", { includeHiddenElements: true })).toBeNull()
  expect(screen.queryByText("+20 kg")).toBeNull()
  expect(screen.getByRole("button", { name: /Press banca.*60.*80 kg.*\+20 kg/ })).toBeOnTheScreen()
})
