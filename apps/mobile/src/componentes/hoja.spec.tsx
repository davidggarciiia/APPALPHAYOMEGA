import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Text, TextInput } from "react-native"

import { Hoja } from "./hoja"
import { useMovimientoReducido } from "./movimiento"

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 18, left: 0 }),
}))
jest.mock("./iconos", () => ({ Icono: () => null }))
jest.mock("react-native/Libraries/Components/Keyboard/KeyboardAvoidingView", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("./movimiento", () => ({
  ...jest.requireActual("./movimiento"),
  useMovimientoReducido: jest.fn(() => false),
}))

it("la hoja conserva su contenido y cierra desde botón, fondo o Android", async () => {
  const cerrar = jest.fn()
  await render(
    <Hoja visible alCerrar={cerrar} titulo="Editar ejercicio">
      <Text>Series</Text>
    </Hoja>,
  )
  const modal = screen.getByTestId("hoja-modal")
  expect(modal.props.transparent).toBe(true)
  expect(modal.props.animationType).toBe("none")
  expect(screen.getByText("Series")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar" }))
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar hoja" }))
  await fireEvent(modal, "requestClose")
  expect(cerrar).toHaveBeenCalledTimes(3)
  expect(screen.getByTestId("hoja-contenido")).toHaveStyle({ paddingBottom: 46 })
})

it("reabrir durante la salida cancela el cierre pendiente", async () => {
  jest.useFakeTimers()
  const cerrar = jest.fn()
  await render(
    <Hoja visible alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  await screen.rerender(
    <Hoja visible={false} alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  await act(() => jest.advanceTimersByTime(100))
  await screen.rerender(
    <Hoja visible alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  await act(() => jest.advanceTimersByTime(300))
  expect(screen.getByText("Contenido")).toBeOnTheScreen()
  expect(cerrar).not.toHaveBeenCalled()
  jest.useRealTimers()
})

it("al activar reducir movimiento durante la salida se cierra sin esperar", async () => {
  jest.useFakeTimers()
  const cerrar = jest.fn()
  await render(
    <Hoja visible alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  await screen.rerender(
    <Hoja visible={false} alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  jest.mocked(useMovimientoReducido).mockReturnValue(true)
  await screen.rerender(
    <Hoja visible={false} alCerrar={cerrar}>
      <Text>Contenido</Text>
    </Hoja>,
  )
  await act(() => jest.advanceTimersByTime(0))
  expect(screen.queryByText("Contenido")).toBeNull()
  jest.useRealTimers()
})

it("mantiene los campos en un scroll que esquiva el teclado con cierre fijo", async () => {
  await render(
    <Hoja visible alCerrar={jest.fn()} titulo="Editar ejercicio">
      <TextInput accessibilityLabel="Series" />
    </Hoja>,
  )
  expect(screen.getByTestId("hoja-esquiva-teclado").props.behavior).toMatch(/padding|height/)
  expect(screen.getByTestId("hoja-scroll").props.keyboardShouldPersistTaps).toBe("handled")
  expect(screen.getByLabelText("Series")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Cerrar" })).toBeOnTheScreen()
})
