import { fireEvent, render, screen } from "@testing-library/react-native"
import EntrenosCliente from "../../app/entrenador/cliente/[id]/entrenos"
import { SemanaEntrenamiento } from "../entrenamiento/semana"

const mockRouter = { push: jest.fn(), dismissTo: jest.fn() }
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "cliente", nombre: "David Demo" }),
  useRouter: () => mockRouter,
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({ estado: { fase: "dentro", usuario: { rol: "entrenador" } } }),
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../entrenamiento/semana", () => ({ SemanaEntrenamiento: jest.fn(() => null) }))

it("conserva el nombre del cliente al abrir su revisión desde Semana", async () => {
  await render(<EntrenosCliente />)
  const props = jest.mocked(SemanaEntrenamiento).mock.calls.at(-1)![0]
  props.abrir("sesion")
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: "sesion", nombre: "David Demo" },
  })
})

it("regresa desde Semana a la ficha de entrenamiento del cliente", async () => {
  await render(<EntrenosCliente />)
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la ficha" }))
  expect(mockRouter.dismissTo).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "cliente" },
  })
})
