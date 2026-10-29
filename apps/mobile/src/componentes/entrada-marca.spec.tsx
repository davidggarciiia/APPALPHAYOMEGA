import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Text } from "react-native"
import { cancelAnimation, withDelay, withTiming } from "react-native-reanimated"

import { CambioDeContenido, EntradaMarca } from "./entrada-marca"

jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  withTiming: jest.fn((valor: number) => valor),
  withDelay: jest.fn((_retraso: number, animacion: unknown) => animacion),
  cancelAnimation: jest.fn(),
}))

afterEach(() => jest.restoreAllMocks())

it("espera el ajuste antes de escalonar la entrada por la diagonal de marca", async () => {
  let resolver!: (reducido: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((r) => {
      resolver = r
    }),
  )
  await render(
    <EntradaMarca indice={1}>
      <Text>Contenido</Text>
    </EntradaMarca>,
  )
  expect(withTiming).not.toHaveBeenCalled()
  await act(() => resolver(false))
  expect(withDelay).toHaveBeenCalledWith(40, expect.anything())
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 260 }))
  expect(screen.getByText("Contenido")).toBeOnTheScreen()
})

it("muestra contenido sin animar con movimiento reducido, incluso al cambiar de pestaña", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(
    <CambioDeContenido clave="uno">
      <Text>Uno</Text>
    </CambioDeContenido>,
  )
  await screen.rerender(
    <CambioDeContenido clave="dos">
      <Text>Dos</Text>
    </CambioDeContenido>,
  )
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.getByText("Dos")).toBeOnTheScreen()
  expect(cancelAnimation).toHaveBeenCalled()
})

it("cancela la entrada si el sistema activa movimiento reducido", async () => {
  let cambiar!: (reducido: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    cambiar = oyente as unknown as typeof cambiar
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
  await render(
    <EntradaMarca>
      <Text>Visible</Text>
    </EntradaMarca>,
  )
  jest.mocked(withTiming).mockClear()
  jest.mocked(cancelAnimation).mockClear()
  await act(() => cambiar(true))
  expect(cancelAnimation).toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.getByText("Visible")).toBeOnTheScreen()
})

it("reserva la transición para cambios de contenido y evita otro efecto al montar", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  await render(
    <CambioDeContenido clave="uno">
      <Text>Uno</Text>
    </CambioDeContenido>,
  )
  expect(withTiming).not.toHaveBeenCalled()
  await screen.rerender(
    <CambioDeContenido clave="dos">
      <Text>Dos</Text>
    </CambioDeContenido>,
  )
  expect(withTiming).toHaveBeenCalledTimes(1)
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 160 }))
})
