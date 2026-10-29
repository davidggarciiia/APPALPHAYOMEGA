import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { withTiming } from "react-native-reanimated"

import { AvisoDeshacer } from "./aviso-deshacer"
import { useMovimientoReducido } from "./movimiento"

jest.mock("./movimiento", () => ({
  ...jest.requireActual("./movimiento"),
  useMovimientoReducido: jest.fn(() => true),
}))
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  withTiming: jest.fn((valor: number) => valor),
}))

beforeEach(() => {
  jest.useFakeTimers()
  jest.mocked(useMovimientoReducido).mockReturnValue(true)
})
afterEach(() => jest.useRealTimers())

it("conserva el vencimiento al remontarse encima de otro control", async () => {
  const iniciadoEn = Date.now()
  const expirar = jest.fn()
  await act(() => jest.advanceTimersByTime(2000))
  await render(
    <AvisoDeshacer
      mensaje="Ejercicio quitado"
      iniciadoEn={iniciadoEn}
      alDeshacer={jest.fn()}
      alExpirar={expirar}
    />,
  )
  await act(() => jest.advanceTimersByTime(2999))
  expect(expirar).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(expirar).toHaveBeenCalledTimes(1)
})

it("permite deshacer una sola vez y cancela el vencimiento", async () => {
  const deshacer = jest.fn()
  const expirar = jest.fn()
  await render(<AvisoDeshacer mensaje="Serie hecha" alDeshacer={deshacer} alExpirar={expirar} />)
  expect(screen.getByText("Serie hecha")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
  await act(() => jest.advanceTimersByTime(6000))
  expect(deshacer).toHaveBeenCalledTimes(1)
  expect(expirar).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Deshacer" })).toBeNull()
})

it("vence a los cinco segundos y reinicia al cambiar el mensaje", async () => {
  const expirar = jest.fn()
  const deshacer = jest.fn()
  await render(<AvisoDeshacer mensaje="Serie hecha" alDeshacer={deshacer} alExpirar={expirar} />)
  await act(() => jest.advanceTimersByTime(4000))
  await screen.rerender(
    <AvisoDeshacer mensaje="Serie omitida" alDeshacer={deshacer} alExpirar={expirar} />,
  )
  await act(() => jest.advanceTimersByTime(4999))
  expect(expirar).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(expirar).toHaveBeenCalledTimes(1)
  await act(() => jest.advanceTimersByTime(5000))
  expect(expirar).toHaveBeenCalledTimes(1)
})

it("al desmontarse cancela la devolución pendiente", async () => {
  const expirar = jest.fn()
  await render(
    <AvisoDeshacer mensaje="Ejercicio quitado" alDeshacer={jest.fn()} alExpirar={expirar} />,
  )
  await screen.unmount()
  await act(() => jest.advanceTimersByTime(6000))
  expect(expirar).not.toHaveBeenCalled()
})

it("renueva el plazo para otra operación aunque repita el mensaje", async () => {
  const expirar = jest.fn()
  const deshacer = jest.fn()
  await render(
    <AvisoDeshacer mensaje="Serie hecha" id={1} alDeshacer={deshacer} alExpirar={expirar} />,
  )
  await act(() => jest.advanceTimersByTime(4500))
  await screen.rerender(
    <AvisoDeshacer mensaje="Serie hecha" id={2} alDeshacer={deshacer} alExpirar={expirar} />,
  )
  await act(() => jest.advanceTimersByTime(4999))
  expect(expirar).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(expirar).toHaveBeenCalledTimes(1)
})

it("conserva los cinco segundos al activar reducir movimiento y deja de interpolar", async () => {
  const expirar = jest.fn()
  const deshacer = jest.fn()
  jest.mocked(useMovimientoReducido).mockReturnValue(false)
  await render(<AvisoDeshacer mensaje="Serie hecha" alDeshacer={deshacer} alExpirar={expirar} />)
  await act(() => jest.advanceTimersByTime(2000))
  jest.mocked(withTiming).mockClear()
  jest.mocked(useMovimientoReducido).mockReturnValue(true)
  await screen.rerender(
    <AvisoDeshacer mensaje="Serie hecha" alDeshacer={deshacer} alExpirar={expirar} />,
  )
  expect(withTiming).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(2999))
  expect(expirar).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(expirar).toHaveBeenCalledTimes(1)
  expect(withTiming).not.toHaveBeenCalled()
})

it("comparte la entrada y opacidad para mantener dos animaciones como máximo", async () => {
  jest.mocked(useMovimientoReducido).mockReturnValue(false)
  jest.mocked(withTiming).mockClear()
  await render(<AvisoDeshacer mensaje="Serie hecha" alDeshacer={jest.fn()} />)
  expect(withTiming).toHaveBeenCalledTimes(2)
})

it("puede aparecer sin movimiento conservando deshacer y el plazo original", async () => {
  jest.mocked(useMovimientoReducido).mockReturnValue(false)
  const expirar = jest.fn()
  const deshacer = jest.fn()
  await render(<AvisoDeshacer mensaje="Serie hecha" alDeshacer={deshacer} alExpirar={expirar} />)
  await act(() => jest.advanceTimersByTime(2000))
  jest.mocked(withTiming).mockClear()
  await screen.rerender(
    <AvisoDeshacer
      mensaje="Serie hecha"
      alDeshacer={deshacer}
      alExpirar={expirar}
      animar={false}
    />,
  )
  expect(withTiming).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(2999))
  expect(expirar).not.toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(1))
  expect(expirar).toHaveBeenCalledTimes(1)
  expect(withTiming).not.toHaveBeenCalled()
})

it("permite animar solo la entrada con el plazo discreto y deshacer sigue disponible", async () => {
  jest.mocked(useMovimientoReducido).mockReturnValue(false)
  jest.mocked(withTiming).mockClear()
  const deshacer = jest.fn()
  const expirar = jest.fn()
  await render(
    <AvisoDeshacer
      mensaje="Serie hecha"
      alDeshacer={deshacer}
      alExpirar={expirar}
      animarPlazo={false}
    />,
  )
  expect(withTiming).toHaveBeenCalledTimes(1)
  expect(withTiming).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 220 }))
  await act(() => jest.advanceTimersByTime(4000))
  await fireEvent.press(screen.getByRole("button", { name: "Deshacer" }))
  await act(() => jest.advanceTimersByTime(2000))
  expect(deshacer).toHaveBeenCalledTimes(1)
  expect(expirar).not.toHaveBeenCalled()
})
