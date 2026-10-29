import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { TextInput } from "react-native"
import { usePathname } from "expo-router"

import { useSesion } from "../sesion"
import { Armazon } from "./armazon"

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }
let mockAncho = 430
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockAncho, height: 800, scale: 1, fontScale: 1 }),
}))
jest.mock("expo-router", () => ({
  usePathname: jest.fn(),
  useRouter: () => mockRouter,
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))
jest.mock("./iconos", () => ({ Icono: () => null }))

function Borrador(): React.JSX.Element {
  const [nombre, setNombre] = useState("")
  return <TextInput accessibilityLabel="Nombre del plan" value={nombre} onChangeText={setNombre} />
}
function Pantalla(): React.JSX.Element {
  return (
    <Armazon>
      <Borrador />
    </Armazon>
  )
}

beforeEach(() => {
  mockAncho = 390
  jest.mocked(usePathname).mockReturnValue("/cartera")
  jest.mocked(useSesion).mockReturnValue({
    estado: {
      fase: "dentro",
      usuario: {
        id: "entrenador",
        nombre: "Entrenador",
        apellidos: null,
        email: "entrenador@prueba.local",
        rol: "entrenador",
        estado: "activo",
      },
      tokenAcceso: "token",
    },
  } as ReturnType<typeof useSesion>)
})

it("ofrece los cuatro destinos del entrenador y selecciona Inicio solo en la raíz", async () => {
  jest.mocked(usePathname).mockReturnValue("/")
  await render(<Pantalla />)
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual([
    "Inicio",
    "Clientes",
    "Rutinas",
    "Ejercicios",
  ])
  expect(screen.getByRole("tab", { name: "Inicio" }).props.accessibilityState).toEqual({
    selected: true,
  })
  await fireEvent.press(screen.getByRole("tab", { name: "Inicio" }))
  expect(mockRouter.replace).toHaveBeenCalledWith("/")

  jest.mocked(usePathname).mockReturnValue("/cartera")
  await screen.rerender(<Pantalla />)
  expect(screen.getByRole("tab", { name: "Inicio" }).props.accessibilityState).toEqual({
    selected: false,
  })
  expect(screen.getByRole("tab", { name: "Clientes" }).props.accessibilityState).toEqual({
    selected: true,
  })
})

it.each(["/", "/cartera"])("el entrenador abre %s sin títulos de relleno", async (ruta) => {
  jest.mocked(usePathname).mockReturnValue(ruta)
  await render(<Pantalla />)
  expect(screen.queryByRole("header")).toBeNull()
  expect(screen.getByRole("button", { name: "E, tu perfil" })).toBeOnTheScreen()
  expect(screen.queryByRole("image", { name: "Alpha & Omega Training" }) !== null).toBe(
    ruta === "/",
  )
})

it.each([
  "/entrenador/cliente/cliente",
  "/entrenador/cliente/cliente/plan",
  "/entrenamiento/sesion",
])("deja la cabecera propia a la pantalla empujada %s", async (ruta) => {
  jest.mocked(usePathname).mockReturnValue(ruta)
  await render(<Pantalla />)
  expect(screen.queryByRole("header")).toBeNull()
  expect(screen.queryByRole("button", { name: "Volver" })).toBeNull()
  expect(screen.queryByRole("tab")).toBeNull()
  expect(screen.getByLabelText("Nombre del plan")).toBeOnTheScreen()
})

it.each(["/", "/entrenamiento", "/nutricion", "/progreso"])(
  "el cliente ve %s sin títulos repetidos",
  async (ruta) => {
    jest.mocked(usePathname).mockReturnValue(ruta)
    jest.mocked(useSesion).mockReturnValue({
      estado: { fase: "dentro", usuario: { nombre: "David", rol: "cliente" } },
    } as ReturnType<typeof useSesion>)
    await render(<Pantalla />)
    expect(screen.queryByRole("header")).toBeNull()
    expect(screen.getByRole("button", { name: "D, tu perfil" })).toBeOnTheScreen()
    expect(screen.getAllByRole("tab")).toHaveLength(4)
  },
)

it.each([430, 1440])(
  "conserva la edición y la navegación al cruzar escritorio desde %i",
  async (ancho) => {
    mockAncho = ancho
    await render(<Pantalla />)
    expect(screen.queryByRole("button", { name: "Mi cuenta" }) !== null).toBe(ancho >= 1024)
    await fireEvent.changeText(screen.getByLabelText("Nombre del plan"), "Plan sin publicar")
    mockAncho = ancho === 430 ? 1440 : 430
    await screen.rerender(<Pantalla />)
    expect(screen.queryByRole("button", { name: "Mi cuenta" }) !== null).toBe(mockAncho >= 1024)
    expect(screen.getByDisplayValue("Plan sin publicar")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("tab", { name: "Ejercicios" }))
    expect(mockRouter.replace).toHaveBeenCalledWith("/catalogo")
    mockAncho = ancho
    await screen.rerender(<Pantalla />)
    expect(screen.getByDisplayValue("Plan sin publicar")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("tab", { name: "Clientes" }))
    expect(mockRouter.replace).toHaveBeenCalledWith("/cartera")
  },
)
