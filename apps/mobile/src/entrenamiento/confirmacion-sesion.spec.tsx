import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { withTiming } from "react-native-reanimated"
import { ConfirmacionSesion } from "./resultado"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withTiming: jest.fn(base.withTiming) }
})
// El reproductor nativo y los recursos reales se verifican en trazo-logo.spec.tsx.
jest.mock("../componentes/trazo-logo", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const { View } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    TrazoLogo: () =>
      React.createElement(View, {
        accessible: true,
        accessibilityLabel: "Alpha & Omega",
        accessibilityRole: "image",
      }),
  }
})

const base = { estado: "enviado" as const, hechas: 12, total: 13, duracion: 4320 }
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("confirma el envío con el resumen y permite salir desde el primer momento", async () => {
  expect(ConfirmacionSesion).toEqual(expect.any(Function))
  const salir = jest.fn()
  await render(<ConfirmacionSesion {...base} salir={salir} />)
  expect(screen.getByRole("header", { name: "ENVIADO" })).toBeTruthy()
  expect(screen.getByRole("text", { name: "12 de 13 series · 1 h 12 min" })).toBeTruthy()
  expect(screen.getByRole("image", { name: "Alpha & Omega" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(salir).toHaveBeenCalledTimes(1)
})

it("distingue el guardado pendiente de un envío y permite reintentarlo", async () => {
  expect(ConfirmacionSesion).toEqual(expect.any(Function))
  const reintentar = jest.fn()
  const vista = await render(
    <ConfirmacionSesion {...base} estado="guardado" reintentar={reintentar} />,
  )
  expect(screen.getByRole("header", { name: "GUARDADO" })).toBeTruthy()
  expect(screen.getByText("Se enviará cuando tengas conexión.")).toBeTruthy()
  expect(screen.queryByRole("header", { name: "ENVIADO" })).toBeNull()
  expect(screen.queryByRole("image", { name: "Alpha & Omega" })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar ahora" }))
  expect(reintentar).toHaveBeenCalledTimes(1)
  await vista.rerender(
    <ConfirmacionSesion {...base} estado="guardado" reintentar={reintentar} ocupado />,
  )
  expect(screen.getByRole("button", { name: "Reintentar ahora" })).toBeDisabled()
})

it("no inventa duración para un registro antiguo y presenta la revisión como microetiqueta", async () => {
  expect(ConfirmacionSesion).toEqual(expect.any(Function))
  await render(<ConfirmacionSesion {...base} duracion={null} revisada />)
  expect(screen.getByRole("text", { name: "12 de 13 series" })).toBeTruthy()
  expect(screen.getByText("Revisado por el entrenador")).toHaveStyle({ fontSize: 11 })
  expect(screen.queryByText(/0 min/)).toBeNull()
})

it("con movimiento reducido presenta todo inmediatamente y no programa interpolaciones", async () => {
  expect(ConfirmacionSesion).toEqual(expect.any(Function))
  await render(<ConfirmacionSesion {...base} salir={() => undefined} />)
  await act(() => jest.advanceTimersByTime(5000))
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.queryByTestId("confirmacion-cortina", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  expect(screen.getByRole("text", { name: "12 de 13 series · 1 h 12 min" })).toBeTruthy()
})

it("mantiene Listo activo mientras ejecuta la firma de movimiento", async () => {
  expect(ConfirmacionSesion).toEqual(expect.any(Function))
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const salir = jest.fn()
  await render(<ConfirmacionSesion {...base} salir={salir} />)
  expect(screen.getByTestId("confirmacion-cortina", { includeHiddenElements: true })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(salir).toHaveBeenCalledTimes(1)
})
