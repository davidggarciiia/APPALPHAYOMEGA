import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { cancelAnimation, withTiming } from "react-native-reanimated"

import { Grafica } from "./grafica"

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
