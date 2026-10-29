import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Text } from "react-native"
import { cancelAnimation, withSpring } from "react-native-reanimated"

import { tema } from "../tema"
import { ENTRADA, SALIDA } from "./movimiento"
import { Pulsable } from "./pulsable"

jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const base = jest.requireActual("react-native-reanimated/mock")
  return {
    ...base,
    useSharedValue: (valor: number) => React.useState(() => ({ value: valor }))[0],
    useAnimatedStyle: (calcular: () => object) => calcular,
    withSpring: jest.fn((valor: number) => valor),
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

const estiloAnimado = (id: string): object => {
  const estilos = screen.getByTestId(id, { includeHiddenElements: true }).props.style as Array<
    object | (() => object)
  >
  return estilos.find((estilo): estilo is () => object => typeof estilo === "function")!()
}

it("conserva nombre, estado, estilo y área táctil, y devuelve la acción al pulsar", async () => {
  const onPress = jest.fn()
  await render(
    <Pulsable
      testID="fila"
      accessibilityLabel="Abrir sesión"
      accessibilityState={{ selected: true }}
      onPress={onPress}
      style={{ padding: 16 }}
    >
      <Text>Empuje</Text>
    </Pulsable>,
  )
  const fila = screen.getByRole("button", { name: "Abrir sesión", selected: true })
  expect(fila).toHaveStyle({ minHeight: 44, minWidth: 44, padding: 16 })
  await fireEvent.press(fila)
  expect(onPress).toHaveBeenCalledTimes(1)
})

it("se contrae al pulsar y recupera la escala con los muelles de marca", async () => {
  await render(
    <Pulsable testID="fila" accessibilityLabel="Abrir" onPress={jest.fn()}>
      <Text>Sesión</Text>
    </Pulsable>,
  )
  await fireEvent(screen.getByRole("button", { name: "Abrir" }), "pressIn", {})
  expect(withSpring).toHaveBeenCalledWith(1, ENTRADA)
  expect(estiloAnimado("fila")).toEqual({ transform: [{ scale: 0.985 }] })
  expect(screen.getByTestId("pulsable-borde", { includeHiddenElements: true })).toHaveStyle({
    borderColor: tema.acento,
  })
  await fireEvent(screen.getByRole("button", { name: "Abrir" }), "pressOut", {})
  expect(withSpring).toHaveBeenCalledWith(0, SALIDA)
  expect(estiloAnimado("fila")).toEqual({ transform: [{ scale: 1 }] })
})

it("con movimiento reducido solo cambia el borde y respeta deshabilitado", async () => {
  const onPress = jest.fn()
  await render(
    <Pulsable testID="fila" accessibilityLabel="Abrir" onPress={onPress}>
      <Text>Sesión</Text>
    </Pulsable>,
  )
  await fireEvent(screen.getByRole("button", { name: "Abrir" }), "pressIn", {})
  await act(() => reducir(true))
  jest.mocked(withSpring).mockClear()
  expect(estiloAnimado("fila")).toEqual({ transform: [{ scale: 1 }] })
  expect(estiloAnimado("pulsable-borde")).toEqual({ opacity: 1 })
  await fireEvent(screen.getByRole("button", { name: "Abrir" }), "pressOut", {})
  expect(withSpring).not.toHaveBeenCalled()
  expect(cancelAnimation).toHaveBeenCalled()
  await screen.rerender(
    <Pulsable testID="fila" accessibilityLabel="Abrir" onPress={onPress} disabled>
      <Text>Sesión</Text>
    </Pulsable>,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Abrir" }))
  expect(onPress).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Abrir" })).toBeDisabled()
})
