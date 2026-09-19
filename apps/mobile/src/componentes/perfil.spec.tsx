import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Perfil from "../../app/perfil"
import { guardarPerfil, leerPerfil } from "../lib/api"
import { useSesion } from "../sesion"

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../lib/api", () => ({
  ...jest.requireActual("../lib/api"),
  leerPerfil: jest.fn(),
  guardarPerfil: jest.fn(),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

const perfil = {
  id: "cliente",
  email: "cliente@prueba.local",
  nombre: "Cliente",
  apellidos: "Demo",
  rol: "cliente" as const,
  estado: "activo" as const,
  telefono: "+34 600 000 000",
  fechaNacimiento: "1995-04-12",
  fotoUrl: null,
}
const pedir = jest.fn()
beforeEach(() => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: perfil, tokenAcceso: "token" },
    salir: jest.fn(),
    pedir,
  } as unknown as ReturnType<typeof useSesion>)
  jest.mocked(leerPerfil).mockResolvedValue(perfil)
})

it("muestra la identidad guardada y actualiza el resumen tras editar los datos", async () => {
  jest.mocked(guardarPerfil).mockResolvedValue({ ...perfil, nombre: "Alex" })
  await render(<Perfil />)
  expect(await screen.findByText("Cliente Demo")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos personales" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Alex")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  expect(await screen.findByText("Alex Demo")).toBeOnTheScreen()
  expect(guardarPerfil).toHaveBeenCalledWith(
    pedir,
    expect.objectContaining({ nombre: "Alex", telefono: "+34 600 000 000" }),
  )
  expect(screen.queryByLabelText("Nombre")).toBeNull()
})

it("conserva los datos escritos cuando cambia el token de acceso", async () => {
  await render(<Perfil />)
  await fireEvent.press(await screen.findByRole("button", { name: "Editar datos personales" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Nombre pendiente")
  const sesion = jest.mocked(useSesion).mock.results[0]!.value as ReturnType<typeof useSesion>
  jest.mocked(useSesion).mockReturnValue({
    ...sesion,
    estado: { fase: "dentro", usuario: perfil, tokenAcceso: "renovado" },
  })
  await screen.rerender(<Perfil />)
  expect(screen.getByDisplayValue("Nombre pendiente")).toBeOnTheScreen()
  expect(leerPerfil).toHaveBeenCalledTimes(1)
})

it("conserva la edición cuando guardar falla y permite cancelar sin cambiar el perfil", async () => {
  jest.mocked(guardarPerfil).mockRejectedValue(new Error("No disponible"))
  await render(<Perfil />)
  await fireEvent.press(await screen.findByRole("button", { name: "Editar datos personales" }))
  await fireEvent.changeText(screen.getByLabelText("Nombre"), "Cambio sin guardar")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar cambios" }))
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/No se han podido guardar/),
  )
  expect(screen.getByDisplayValue("Cambio sin guardar")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cancelar" }))
  expect(screen.getByText("Cliente Demo")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos personales" }))
  expect(screen.getByDisplayValue("Cliente")).toBeOnTheScreen()
})
