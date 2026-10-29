import { fireEvent, render, screen } from "@testing-library/react-native"
import DetalleEntrenamiento from "../../app/entrenamiento/[id]"

const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "sesion" }),
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: mockReplace }),
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({ estado: { fase: "dentro", usuario: { id: "cliente", rol: "cliente" } } }),
}))
jest.mock("./use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../entrenamiento-entrenador/detalle", () => ({ DetalleEntrenador: () => null }))
jest.mock("./registro-cliente", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    RegistroCliente: ({ salir, listo }: { salir: () => void; listo?: () => void }) => (
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="Salir" onPress={salir}>
          <Text>Salir</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Listo" onPress={listo}>
          <Text>Listo</Text>
        </Pressable>
      </>
    ),
  }
})

it("Listo vuelve a Hoy y salir de una sesión abierta conserva la navegación anterior", async () => {
  await render(<DetalleEntrenamiento />)
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(mockReplace).toHaveBeenCalledWith("/")
  expect(mockBack).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Salir" }))
  expect(mockBack).toHaveBeenCalledTimes(1)
})
