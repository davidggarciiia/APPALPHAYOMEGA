import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { cancelAnimation, withSpring, withTiming } from "react-native-reanimated"
import { BarraPestanas } from "./barra-pestanas"
import { vibrar } from "./botones"

jest.mock("./botones", () => ({ vibrar: jest.fn() }))
jest.mock("./iconos", () => ({ Icono: () => null }))
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const doble = jest.requireActual("react-native-reanimated/mock")
  return {
    ...doble,
    useSharedValue: (valor: number) => React.useState(() => ({ value: valor }))[0],
    cancelAnimation: jest.fn(doble.cancelAnimation),
    withSpring: jest.fn(doble.withSpring),
    withTiming: jest.fn(doble.withTiming),
  }
})

afterEach(() => jest.restoreAllMocks())

const destinos = [
  { clave: "/", nombre: "Inicio", icono: "inicio" },
  { clave: "/plan", nombre: "Plan", icono: "plan" },
] satisfies Parameters<typeof BarraPestanas>[0]["destinos"]

it("solicita el destino y conserva la selección hasta que la ruta cambia", async () => {
  const cambiar = jest.fn()
  await render(<BarraPestanas destinos={destinos} activa="/" alCambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("tab", { name: "Plan" }))
  expect(cambiar).toHaveBeenCalledWith("/plan")
  expect(vibrar).toHaveBeenCalledWith("suave")
  expect(screen.getByRole("tab", { name: "Inicio" }).props.accessibilityState).toEqual({
    selected: true,
  })
  await screen.rerender(<BarraPestanas destinos={destinos} activa="/plan" alCambiar={cambiar} />)
  expect(screen.getByRole("tab", { name: "Plan" }).props.accessibilityState).toEqual({
    selected: true,
  })
})

it("con movimiento reducido cambia la selección y mantiene la háptica sin animaciones", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(true)
  await render(<BarraPestanas destinos={destinos} activa="/" alCambiar={jest.fn()} />)
  await screen.rerender(<BarraPestanas destinos={destinos} activa="/plan" alCambiar={jest.fn()} />)
  expect(screen.getByRole("tab", { name: "Plan" }).props.accessibilityState).toEqual({
    selected: true,
  })
  expect(withSpring).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("tab", { name: "Inicio" }))
  expect(vibrar).toHaveBeenCalledWith("suave")
})

it("cancela el movimiento al activar el ajuste del sistema con la barra abierta", async () => {
  let cambiarMovimiento: (activo: boolean) => void = () => undefined
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_evento, oyente) => {
    cambiarMovimiento = oyente as unknown as (activo: boolean) => void
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>
  })
  await render(<BarraPestanas destinos={destinos} activa="/" alCambiar={jest.fn()} />)
  await screen.rerender(<BarraPestanas destinos={destinos} activa="/plan" alCambiar={jest.fn()} />)
  expect(withSpring).toHaveBeenCalled()
  jest.mocked(cancelAnimation).mockClear()
  jest.mocked(withSpring).mockClear()
  jest.mocked(withTiming).mockClear()
  await act(() => cambiarMovimiento(true))
  expect(cancelAnimation).toHaveBeenCalledTimes(2)
  expect(withSpring).not.toHaveBeenCalled()
  expect(withTiming).not.toHaveBeenCalled()
  expect(screen.getByRole("tab", { name: "Plan" }).props.accessibilityState.selected).toBe(true)
})
