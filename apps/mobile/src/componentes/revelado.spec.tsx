import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Text } from "react-native"
import { cancelAnimation, withDelay, withTiming } from "react-native-reanimated"

import { Revelado } from "./revelado"

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const base = jest.requireActual("react-native-reanimated/mock")
  return {
    ...base,
    useSharedValue: (valor: number) => React.useState(() => ({ value: valor }))[0],
    withTiming: jest.fn(base.withTiming),
    withDelay: jest.fn(base.withDelay),
    cancelAnimation: jest.fn(),
  }
})

let reducir: (valor: boolean) => void
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    reducir = oyente as unknown as (valor: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => jest.restoreAllMocks())

it("retira el corte tras 900 ms sin ocultar el título al lector de pantalla", async () => {
  await render(
    <Revelado>
      <Text>ENVIADO</Text>
    </Revelado>,
  )
  expect(screen.getByText("ENVIADO")).toBeOnTheScreen()
  expect(withDelay).toHaveBeenCalledWith(900, expect.anything())
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 320 }))
  await act(() => reducir(true))
  expect(screen.queryByTestId("revelado-cortina", { includeHiddenElements: true })).toBeNull()
  expect(cancelAnimation).toHaveBeenCalled()
})

it("con movimiento reducido muestra el contenido entero sin cortina ni temporizador animado", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(
    <Revelado>
      <Text>ENVIADO</Text>
    </Revelado>,
  )
  expect(screen.getByText("ENVIADO")).toBeOnTheScreen()
  expect(withDelay).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
})

it("mientras consulta el ajuste mantiene el título cubierto y solo inicia el revelado tras resolver false", async () => {
  let resolver!: (valor: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((r) => {
      resolver = r
    }),
  )
  await render(
    <Revelado>
      <Text>ENVIADO</Text>
    </Revelado>,
  )
  expect(screen.getByTestId("revelado-cortina", { includeHiddenElements: true })).toHaveStyle({
    opacity: 1,
  })
  expect(withDelay).not.toHaveBeenCalled()
  await act(() => resolver(false))
  expect(withDelay).toHaveBeenCalledTimes(1)
  expect(withDelay).toHaveBeenCalledWith(900, expect.anything())
})

it("tras terminar no vuelve a tapar el título al activar y desactivar movimiento reducido", async () => {
  await render(
    <Revelado>
      <Text>ENVIADO</Text>
    </Revelado>,
  )
  expect(withDelay).toHaveBeenCalledTimes(1)
  await act(() => reducir(true))
  jest.mocked(withDelay).mockClear()
  jest.mocked(withTiming).mockClear()
  await act(() => reducir(false))
  expect(withDelay).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.getByTestId("revelado-cortina", { includeHiddenElements: true })).toHaveStyle({
    opacity: 0,
  })
})

it("si el ajuste inicial era reducido, desactivarlo después conserva el título entero", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  await render(
    <Revelado>
      <Text>ENVIADO</Text>
    </Revelado>,
  )
  await act(() => reducir(false))
  expect(withDelay).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
})
