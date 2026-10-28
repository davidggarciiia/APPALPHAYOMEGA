import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { useLocalSearchParams } from "expo-router"

import Activar from "../../app/activar"
import Login from "../../app/login"
import { useSesion } from "../sesion"
import { activarCuenta, ErrorDelServidor } from "./api"

const mockReplace = jest.fn()
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("./api", () => ({ ...jest.requireActual("./api"), activarCuenta: jest.fn() }))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

const CONTRASENA = "Contrasena-segura-2026"

async function rellenarContrasenas(): Promise<void> {
  await fireEvent.changeText(screen.getByLabelText("Contraseña"), CONTRASENA)
  await fireEvent.changeText(screen.getByLabelText("Repítela"), CONTRASENA)
}

describe("activar cuenta", () => {
  beforeEach(() => {
    mockReplace.mockClear()
    jest.mocked(useLocalSearchParams).mockReturnValue({ token: "token-del-correo" })
  })

  it("al activar confirma el éxito y deja entrar con un botón, sin saltar al login a ciegas", async () => {
    jest.mocked(activarCuenta).mockResolvedValue(undefined)
    await render(<Activar />)
    await rellenarContrasenas()
    await fireEvent.press(screen.getByRole("button", { name: "ACTIVAR MI CUENTA" }))
    expect(await screen.findByText("Cuenta activada")).toBeOnTheScreen()
    expect(activarCuenta).toHaveBeenCalledWith("token-del-correo", CONTRASENA)
    expect(mockReplace).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole("button", { name: "ENTRAR" }))
    expect(mockReplace).toHaveBeenCalledWith("/login")
  })

  it("con un enlace que ya no sirve explica el motivo y deja una salida", async () => {
    jest.mocked(activarCuenta).mockRejectedValue(new ErrorDelServidor(400))
    await render(<Activar />)
    await rellenarContrasenas()
    await fireEvent.press(screen.getByRole("button", { name: "ACTIVAR MI CUENTA" }))
    expect(await screen.findByText(/Este enlace ya no sirve/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "VOLVER A ENTRAR" }))
    expect(mockReplace).toHaveBeenCalledWith("/login")
  })

  it("sin token no es un callejón sin salida", async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({})
    await render(<Activar />)
    expect(screen.getByText("Enlace incompleto")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "VOLVER A ENTRAR" }))
    expect(mockReplace).toHaveBeenCalledWith("/login")
  })

  it("dos «Go» seguidos del teclado envían una sola vez", async () => {
    let terminar = (): void => undefined
    jest.mocked(activarCuenta).mockImplementation(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver
        }),
    )
    await render(<Activar />)
    await rellenarContrasenas()
    const repetida = screen.getByLabelText("Repítela")
    await fireEvent(repetida, "submitEditing")
    await fireEvent(repetida, "submitEditing")
    await waitFor(() => expect(activarCuenta).toHaveBeenCalledTimes(1))
    terminar()
    expect(await screen.findByText("Cuenta activada")).toBeOnTheScreen()
  })
})

describe("entrar", () => {
  it("dos «Go» seguidos del teclado entran una sola vez", async () => {
    let terminar = (): void => undefined
    const entrar = jest.fn(
      () =>
        new Promise<void>((resolver) => {
          terminar = resolver
        }),
    )
    jest.mocked(useSesion).mockReturnValue({
      entrar,
      sesionCaducada: false,
    } as unknown as ReturnType<typeof useSesion>)
    await render(<Login />)
    await fireEvent.changeText(screen.getByLabelText("Correo"), "cliente@prueba.local")
    await fireEvent.changeText(screen.getByLabelText("Contraseña"), "cualquiera")
    const contrasena = screen.getByLabelText("Contraseña")
    await fireEvent(contrasena, "submitEditing")
    await fireEvent(contrasena, "submitEditing")
    await waitFor(() => expect(entrar).toHaveBeenCalledTimes(1))
    terminar()
  })
})
