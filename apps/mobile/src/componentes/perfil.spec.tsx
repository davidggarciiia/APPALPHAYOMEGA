import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Perfil from "../../app/perfil"
import { guardarPerfil, leerPerfil } from "../lib/api"
import { useSesion } from "../sesion"
import { TarjetaConsentimiento } from "../consentimiento"

const mockReplace = jest.fn()
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: mockReplace,
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
jest.mock("../consentimiento", () => ({ TarjetaConsentimiento: jest.fn(() => null) }))

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

it("presenta un esqueleto mientras espera el perfil", async () => {
  jest.mocked(leerPerfil).mockReturnValue(new Promise(() => undefined))
  await render(<Perfil />)
  expect(screen.getByLabelText("Cargando tu perfil")).toHaveProp("accessibilityState", {
    busy: true,
  })
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThan(1)
  expect(screen.queryByRole("progressbar")).toBeNull()
})

it("mantiene los teclados de teléfono y fecha al abrir la edición", async () => {
  await render(<Perfil />)
  await fireEvent.press(await screen.findByRole("button", { name: "Editar datos personales" }))
  expect(screen.getByLabelText("Teléfono")).toHaveProp("keyboardType", "phone-pad")
  expect(screen.getByLabelText("Fecha de nacimiento")).toHaveProp(
    "keyboardType",
    "numbers-and-punctuation",
  )
})

it("permite volver al inicio aunque falle la carga del perfil", async () => {
  jest.mocked(leerPerfil).mockRejectedValueOnce(new Error("Sin conexión"))
  await render(<Perfil />)
  expect(await screen.findByRole("alert")).toHaveTextContent(/No hemos podido cargar tu perfil/)
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(mockReplace).toHaveBeenCalledWith("/")
})

it("el entrenador tiene su perfil común, sin consentimiento, y cierra sesión desde aquí", async () => {
  const entrenador = { ...perfil, nombre: "Carlos", rol: "entrenador" as const }
  const salir = jest.fn()
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", usuario: entrenador, tokenAcceso: "token" },
    salir,
    pedir,
  } as unknown as ReturnType<typeof useSesion>)
  jest.mocked(leerPerfil).mockResolvedValue(entrenador)
  await render(<Perfil />)
  expect(await screen.findByRole("header", { name: "Carlos Demo" })).toBeOnTheScreen()
  expect(screen.getByText("entrenador")).toBeOnTheScreen()
  expect(screen.getByText("activo")).toBeOnTheScreen()
  expect(TarjetaConsentimiento).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar sesión" }))
  expect(salir).toHaveBeenCalledTimes(1)
})

it("mantiene el consentimiento en el perfil del cliente", async () => {
  await render(<Perfil />)
  await screen.findByRole("header", { name: "Cliente Demo" })
  expect(TarjetaConsentimiento).toHaveBeenCalled()
})

it("reintenta la carga fallida y permite editar después", async () => {
  jest.mocked(leerPerfil).mockRejectedValueOnce(new Error("Sin red"))
  await render(<Perfil />)
  await screen.findByRole("alert")
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByRole("header", { name: "Cliente Demo" })).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Editar datos personales" }))
  expect(screen.getByLabelText("Teléfono")).toHaveProp("keyboardType", "phone-pad")
})
