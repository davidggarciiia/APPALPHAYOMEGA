import { fireEvent, render, screen } from "@testing-library/react-native"
import FichaDeCliente from "../../app/cliente/[id]"
import { leerUsuario } from "../lib/api"
import { useSesion } from "../sesion"

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "10000000-0000-4000-8000-000000000001" }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), setParams: jest.fn() }),
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

it("renovar el token conserva la edición de contacto de un cliente", async () => {
  const sesion = {
    estado: { fase: "dentro", usuario: ficha, tokenAcceso: "inicial" },
    pedir: jest.fn(),
    salir: jest.fn(),
  }
  jest.mocked(useSesion).mockReturnValue(sesion as unknown as ReturnType<typeof useSesion>)
  jest.mocked(leerUsuario).mockResolvedValue(ficha)
  await render(<FichaDeCliente />)
  await fireEvent.changeText(await screen.findByLabelText("Nombre"), "Nombre pendiente")
  jest.mocked(useSesion).mockReturnValue({
    ...sesion,
    estado: { ...sesion.estado, tokenAcceso: "renovado" },
  } as unknown as ReturnType<typeof useSesion>)
  await screen.rerender(<FichaDeCliente />)
  expect(screen.getByDisplayValue("Nombre pendiente")).toBeOnTheScreen()
  expect(leerUsuario).toHaveBeenCalledTimes(1)
})
