import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, processColor } from "react-native"
import { cancelAnimation, withTiming } from "react-native-reanimated"

import { Grafica } from "./grafica"
import { tema } from "../tema"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withTiming: jest.fn(base.withTiming), cancelAnimation: jest.fn() }
})

const puntos = [
  { fecha: "2026-10-01", valor: 80 },
  { fecha: "2026-10-05", valor: 79.5 },
]
const grafica = (valores = puntos) => (
  <Grafica
    animar
    puntos={valores}
    tendencia={valores}
    descripcion="Peso: de 80 a 79,5 kg"
    izquierda="1 oct"
    derecha="5 oct"
  />
)
let reducir: (valor: boolean) => void
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    reducir = oyente as unknown as (valor: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

it("no dibuja una gráfica con un solo punto", async () => {
  await render(grafica(puntos.slice(0, 1)))
  expect(screen.queryByRole("image")).toBeNull()
})

it("dibuja el trazo durante 900 ms, con cinco fechas y resumen accesible", async () => {
  await render(grafica())
  await fireEvent(screen.getByRole("image", { name: "Peso: de 80 a 79,5 kg" }), "layout", {
    nativeEvent: { layout: { width: 330, height: 140 } },
  })
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 900 }))
  expect(screen.getAllByTestId("grafica-fecha")).toHaveLength(5)
  await act(() => reducir(true))
  expect(cancelAnimation).toHaveBeenCalled()
})

it("muestra el trazo completo sin interpolación con movimiento reducido", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(grafica())
  await fireEvent(screen.getByRole("image"), "layout", {
    nativeEvent: { layout: { width: 330, height: 140 } },
  })
  expect(withTiming).not.toHaveBeenCalled()
})

it("otros gráficos permanecen estáticos para respetar el presupuesto de movimiento", async () => {
  await render(
    <Grafica
      puntos={puntos}
      tendencia={puntos}
      descripcion="Cargas"
      izquierda="1 oct"
      derecha="5 oct"
    />,
  )
  await fireEvent(screen.getByRole("image"), "layout", {
    nativeEvent: { layout: { width: 330, height: 140 } },
  })
  expect(withTiming).not.toHaveBeenCalled()
})

const semanas = [
  { fecha: "2026-10-12", valor: 57.5 },
  { fecha: "2026-10-19", valor: 60 },
  { fecha: "2026-10-26", valor: 62.5 },
]
const estimados = semanas.map((punto) => ({ ...punto, valor: punto.valor * (1 + 10 / 30) }))
const decorativo = { includeHiddenElements: true }
const fuerza = () => (
  <Grafica
    animar
    puntos={semanas.map((punto) => ({ ...punto }))}
    tendencia={[]}
    comparacion={estimados.map((punto) => ({ ...punto }))}
    descripcion="Mejor serie y 1RM estimado por semana, en kg"
    izquierda="12 oct"
    derecha="26 oct"
  />
)

it("compara kg y 1RM sobre un mismo eje, con fechas reales y trazos distintos", async () => {
  await render(fuerza())
  await fireEvent(screen.getByRole("image"), "layout", {
    nativeEvent: { layout: { width: 330, height: 156 } },
  })
  expect(screen.getAllByTestId("grafica-fecha").map((fecha) => fecha.props.children)).toEqual([
    "12 oct",
    "19 oct",
    "26 oct",
  ])
  expect(screen.getByTestId("grafica-comparacion", decorativo).props).toEqual(
    expect.objectContaining({
      stroke: { type: 0, payload: processColor(tema.textoTenue) },
      strokeWidth: 2,
      strokeDasharray: [5, 5],
    }),
  )
  expect(screen.getByTestId("grafica-linea", decorativo).props.d).not.toBe(
    screen.getByTestId("grafica-comparacion", decorativo).props.d,
  )
  const rotulo = screen.getByTestId("grafica-valor-final", decorativo)
  expect(rotulo.children).toEqual([
    expect.objectContaining({ props: expect.objectContaining({ content: "62,5" }) }),
  ])
  const eje = screen.getAllByTestId("grafica-eje-kg", decorativo).flatMap((marca) => marca.children)
  expect(eje.map((hijo) => (typeof hijo === "string" ? hijo : hijo.props.content))).toContain("60")
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }))
})

it("no vuelve a animar la comparación al refrescar los mismos puntos", async () => {
  const vista = await render(fuerza())
  await fireEvent(screen.getByRole("image"), "layout", {
    nativeEvent: { layout: { width: 330, height: 156 } },
  })
  jest.mocked(withTiming).mockClear()
  await vista.rerender(fuerza())
  expect(withTiming).not.toHaveBeenCalled()
})

it("muestra ambas series completas sin interpolación con movimiento reducido", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(fuerza())
  await fireEvent(screen.getByRole("image"), "layout", {
    nativeEvent: { layout: { width: 330, height: 156 } },
  })
  expect(screen.getByTestId("grafica-comparacion", decorativo)).toBeTruthy()
  expect(withTiming).not.toHaveBeenCalled()
})
