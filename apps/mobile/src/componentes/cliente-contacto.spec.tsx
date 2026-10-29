import { render, screen, waitFor } from "@testing-library/react-native"
import FichaDeCliente from "../../app/cliente/[id]"
import { ErrorDeSesion, ErrorDelServidor, leerUsuario } from "../lib/api"
import { useSesion } from "../sesion"

const mockReplace = jest.fn()
const mockDatos = jest.fn()
let mockParametros: { id?: string | string[]; correoFallido?: string } = {}
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParametros,
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, setParams: jest.fn() }),
}))
jest.mock("../clientes/datos-del-cliente", () => ({
  DatosDelCliente: (props: unknown) => {
    mockDatos(props)
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native")
    return <Text>Datos reutilizados</Text>
  },
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), leerUsuario: jest.fn() }))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
const ficha = {
  id: "10000000-0000-4000-8000-000000000001",
  nombre: "Lara",
  apellidos: "Demo",
  email: "lara@prueba.local",
  rol: "cliente" as const,
  estado: "activo" as const,
  telefono: null,
  fechaNacimiento: null,
  creadoEn: "2026-10-27T10:00:00Z",
  tieneContrasena: true,
}

beforeEach(() => {
  mockParametros = { id: ficha.id }
  jest.mocked(useSesion).mockReturnValue({
    estado: {
      fase: "dentro",
      usuario: { id: "entrenador", rol: "entrenador" },
      tokenAcceso: "token",
    },
    pedir: jest.fn(),
    salir: jest.fn(),
  } as unknown as ReturnType<typeof useSesion>)
  jest.mocked(leerUsuario).mockResolvedValue(ficha)
})

it("el acceso antiguo del cliente abre los datos en su ficha y conserva el fallo de correo", async () => {
  mockParametros.correoFallido = "1"
  await render(<FichaDeCliente />)
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/entrenador/cliente/[id]",
      params: { id: ficha.id, datos: "1", correoFallido: "1" },
    }),
  )
  expect(mockDatos).not.toHaveBeenCalled()
})

it("la gestión de nutricionistas conserva el formulario compartido sin abrir ficha de entrenamiento", async () => {
  jest.mocked(leerUsuario).mockResolvedValue({ ...ficha, rol: "nutricionista" })
  await render(<FichaDeCliente />)
  expect(await screen.findByText("Datos reutilizados")).toBeOnTheScreen()
  expect(mockDatos).toHaveBeenLastCalledWith(expect.objectContaining({ clienteId: ficha.id }))
  expect(mockReplace).not.toHaveBeenCalled()
})

it("un enlace sin identificador muestra un error sin consultar usuarios", async () => {
  mockParametros = {}
  await render(<FichaDeCliente />)
  expect(screen.getByText("No sabemos de quién es esta ficha.")).toBeOnTheScreen()
  expect(leerUsuario).not.toHaveBeenCalled()
})

it("sin cuenta de entrenador no consulta ni muestra datos", async () => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: { id: ficha.id, rol: "cliente" } },
  } as unknown as ReturnType<typeof useSesion>)
  await render(<FichaDeCliente />)
  expect(screen.getByText("Esta pantalla requiere una cuenta de entrenador.")).toBeOnTheScreen()
  expect(leerUsuario).not.toHaveBeenCalled()
})

it("una cuenta inexistente no ofrece reintentar", async () => {
  jest.mocked(leerUsuario).mockRejectedValue(new ErrorDelServidor(404))
  await render(<FichaDeCliente />)
  expect(await screen.findByText("Esta cuenta ya no existe.")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})

it("la sesión caducada ofrece volver a entrar en lugar de reintentar", async () => {
  jest.mocked(leerUsuario).mockRejectedValue(new ErrorDeSesion())
  await render(<FichaDeCliente />)
  expect(await screen.findByRole("button", { name: "Volver a entrar" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})
