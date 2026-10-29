import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import * as ReactNative from "react-native"
import { cancelAnimation, withTiming } from "react-native-reanimated"

import { NumeroGiro } from "./numero-giro"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withTiming: jest.fn(base.withTiming), cancelAnimation: jest.fn() }
})

let reducir: (valor: boolean) => void
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    reducir = oyente as unknown as (valor: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("anuncia el valor entero y gira al cambiar sin duplicar los dígitos para el lector", async () => {
  const vista = await render(<NumeroGiro valor={12} />)
  expect(screen.getByRole("text", { name: "12" })).toBeOnTheScreen()
  jest.mocked(withTiming).mockClear()
  await vista.rerender(<NumeroGiro valor={13} />)
  expect(screen.getByRole("text", { name: "13" })).toBeOnTheScreen()
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 140 }))
  expect(screen.getByTestId("numero-anterior", { includeHiddenElements: true })).toBeOnTheScreen()
})

it("las repeticiones a menos de 100 ms sustituyen la cifra directamente", async () => {
  const vista = await render(<NumeroGiro valor={12} />)
  await vista.rerender(<NumeroGiro valor={13} />)
  await act(() => jest.advanceTimersByTime(90))
  jest.mocked(withTiming).mockClear()
  await vista.rerender(<NumeroGiro valor={14} />)
  expect(screen.getByRole("text", { name: "14" })).toBeOnTheScreen()
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.queryByTestId("numero-anterior", { includeHiddenElements: true })).toBeNull()
})

it("al activar movimiento reducido cancela el giro y los siguientes valores son instantáneos", async () => {
  const vista = await render(<NumeroGiro valor={12} />)
  await vista.rerender(<NumeroGiro valor={13} />)
  await act(() => reducir(true))
  expect(cancelAnimation).toHaveBeenCalled()
  jest.mocked(withTiming).mockClear()
  await act(() => jest.advanceTimersByTime(200))
  await vista.rerender(<NumeroGiro valor="15,5" />)
  expect(screen.getByRole("text", { name: "15,5" })).toBeOnTheScreen()
  expect(withTiming).not.toHaveBeenCalled()
})

it("reserva espacio para las cifras con tamaño de texto grande", async () => {
  jest
    .spyOn(ReactNative, "useWindowDimensions")
    .mockReturnValue({ width: 390, height: 800, scale: 1, fontScale: 2 })
  await render(<NumeroGiro valor={1} estilo={{ fontSize: 30, lineHeight: 34, minWidth: 44 }} />)
  const cifra = screen.getByText("1", { includeHiddenElements: true })
  expect(cifra.parent).toHaveStyle({ width: 39.6, height: 68 })
  expect(cifra).toHaveStyle({ minWidth: 0 })
})
