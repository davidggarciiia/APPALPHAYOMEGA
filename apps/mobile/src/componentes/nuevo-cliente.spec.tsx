import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import NuevoCliente from "../../app/cliente/nuevo"
import { crearUsuario, ErrorDelServidor } from "../lib/api"
import { useSesion } from "../sesion"

const mockReplace = jest.fn()
let mockParametros: { rol?: string } = {}
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParametros,
  useRouter: () => ({ back: jest.fn(), replace: mockReplace }),
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), crearUsuario: jest.fn() }))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

const CLIENTE = "10000000-0000-4000-8000-000000000001"

beforeEach(() => {
  mockParametros = {}
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", tokenAcceso: "token", usuario: { rol: "entrenador" } },
    pedir: jest.fn(),
  } as unknown as ReturnType<typeof useSesion>)
  jest
    .mocked(crearUsuario)
    .mockResolvedValue({ id: CLIENTE, correoEnviado: true } as Awaited<
      ReturnType<typeof crearUsuario>
    >)
})

async function darDeAlta(): Promise<void> {
  await render(<NuevoCliente />)
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Lara")
  await fireEvent.changeText(screen.getByLabelText("Apellidos"), "Demo")
  await fireEvent.changeText(screen.getByLabelText("Correo"), "lara@prueba.local")
  await fireEvent.press(screen.getByRole("button", { name: "DAR DE ALTA" }))
}

it("tras crear un cliente ofrece su valoración inicial sin volver a crearlo", async () => {
  await darDeAlta()
  const valorar = await screen.findByRole("button", { name: "Valoración inicial" })
  expect(mockReplace).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "DAR DE ALTA" })).toBeNull()
  await fireEvent.press(valorar)
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: CLIENTE, valoracionInicial: "1" },
  })
  expect(crearUsuario).toHaveBeenCalledTimes(1)
})

it("un correo no enviado conserva el acceso para reenviar la activación", async () => {
  jest
    .mocked(crearUsuario)
    .mockResolvedValue({ id: CLIENTE, correoEnviado: false } as Awaited<
      ReturnType<typeof crearUsuario>
    >)
  await darDeAlta()
  expect(await screen.findByText(/no se pudo enviar el correo/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Datos y acceso" }))
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/cliente/[id]",
    params: { id: CLIENTE, correoFallido: "1" },
  })
})

it("el alta de nutricionista conserva su ficha y no ofrece valoración", async () => {
  mockParametros = { rol: "nutricionista" }
  await darDeAlta()
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/cliente/[id]",
      params: { id: CLIENTE, correoFallido: "0" },
    }),
  )
  expect(screen.queryByRole("button", { name: "Valoración inicial" })).toBeNull()
})

it("un alta fallida permite corregir los datos sin ofrecer valoración", async () => {
  jest.mocked(crearUsuario).mockRejectedValue(new ErrorDelServidor(409))
  await darDeAlta()
  expect(await screen.findByText("Ya existe una cuenta con ese correo.")).toBeOnTheScreen()
  expect(screen.getByDisplayValue("lara@prueba.local")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Valoración inicial" })).toBeNull()
})
