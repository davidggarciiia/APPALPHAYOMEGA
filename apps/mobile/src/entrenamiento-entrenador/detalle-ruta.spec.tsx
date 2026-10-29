import { render, screen } from "@testing-library/react-native"
import DetalleEntrenamiento from "../../app/entrenamiento/[id]"
import { RegistroCliente } from "../entrenamiento/registro-cliente"
import { DetalleEntrenador } from "./detalle"
import { useSesion } from "../sesion"

const mockRouter = { back: jest.fn(), canGoBack: () => false, replace: jest.fn() }
const mockApi = {}
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "sesion", nombre: "David" }),
  useRouter: () => mockRouter,
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => mockApi }))
jest.mock("../entrenamiento/registro-cliente", () => ({ RegistroCliente: jest.fn(() => null) }))
jest.mock("./detalle", () => ({ DetalleEntrenador: jest.fn(() => null) }))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

it("abre la revisión con nombre del cliente y volver a Cartera si no hay historial", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: "entrenador" } },
  } as ReturnType<typeof useSesion>)
  await render(<DetalleEntrenamiento />)
  const props = jest.mocked(DetalleEntrenador).mock.calls.at(-1)![0]
  expect(props).toMatchObject({ id: "sesion", nombreCliente: "David", api: mockApi })
  expect(props.salir).toEqual(expect.any(Function))
  props.salir?.()
  expect(mockRouter.replace).toHaveBeenCalledWith("/cartera")
  expect(RegistroCliente).not.toHaveBeenCalled()
})

it("conserva la sesión del cliente y su regreso a Plan", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: "cliente", rol: "cliente" } },
  } as ReturnType<typeof useSesion>)
  await render(<DetalleEntrenamiento />)
  const props = jest.mocked(RegistroCliente).mock.calls.at(-1)![0]
  expect(props).toMatchObject({ id: "sesion", cuenta: "cliente", api: mockApi })
  expect(props.salir).toEqual(expect.any(Function))
  props.salir?.()
  expect(mockRouter.replace).toHaveBeenCalledWith("/entrenamiento")
  props.listo?.()
  expect(mockRouter.replace).toHaveBeenCalledWith("/")
  expect(DetalleEntrenador).not.toHaveBeenCalled()
})

it("conserva la restricción de la revisión a cuentas de entrenador", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: "nutricionista", rol: "nutricionista" } },
  } as ReturnType<typeof useSesion>)
  await render(<DetalleEntrenamiento />)
  expect(screen.getByText("Inicia sesión para abrir el entrenamiento.")).toBeOnTheScreen()
  expect(DetalleEntrenador).not.toHaveBeenCalled()
  expect(RegistroCliente).not.toHaveBeenCalled()
})
