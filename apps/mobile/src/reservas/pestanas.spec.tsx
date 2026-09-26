import { fireEvent, render, screen } from "@testing-library/react-native"
import { Text } from "react-native"

import { Armazon } from "../componentes/armazon"
import { useSesion } from "../sesion"

const mockRuta = { actual: "/" }
const mockReplace = jest.fn()
const mockAncho = { actual: 390 }
jest.mock("expo-router", () => ({
  usePathname: () => mockRuta.actual,
  useRouter: () => ({
    replace: mockReplace,
    push: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: mockAncho.actual, height: 844, scale: 2, fontScale: 1 }),
}))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

type Rol = "cliente" | "entrenador"

function entrarComo(rol: Rol, fase: "dentro" | "local" = "dentro"): void {
  const usuario = {
    id: "30000000-0000-4000-8000-000000000001",
    email: `${rol}@prueba.local`,
    nombre: "Lara",
    apellidos: null,
    rol,
    estado: "activo" as const,
  }
  jest.mocked(useSesion).mockReturnValue({
    estado:
      fase === "dentro"
        ? { fase, usuario, tokenAcceso: "token" }
        : { fase, usuario: { id: usuario.id, nombre: usuario.nombre, rol } },
  } as unknown as ReturnType<typeof useSesion>)
}

const pestanas = (): string[] =>
  screen.getAllByRole("tab").map((tab) => String(tab.props.accessibilityLabel))

beforeEach(() => {
  mockRuta.actual = "/"
  mockAncho.actual = 390
})

describe("Pestañas por rol", () => {
  it("el entrenador tiene Hoy, Agenda, Clientes, Rutinas y Ejercicios", async () => {
    entrarComo("entrenador")
    await render(
      <Armazon>
        <Text>Contenido</Text>
      </Armazon>,
    )
    expect(pestanas()).toEqual(["Hoy", "Agenda", "Clientes", "Rutinas", "Ejercicios"])
    expect(screen.getByRole("tab", { name: "Hoy", selected: true })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("tab", { name: "Agenda" }))
    expect(mockReplace).toHaveBeenCalledWith("/agenda")
  })

  it("el cliente tiene Entreno, Plan, Reservar, Nutrición y Progreso", async () => {
    entrarComo("cliente")
    mockRuta.actual = "/reservar"
    await render(
      <Armazon>
        <Text>Contenido</Text>
      </Armazon>,
    )
    expect(pestanas()).toEqual(["Entreno", "Plan", "Reservar", "Nutrición", "Progreso"])
    expect(screen.getByRole("tab", { name: "Reservar", selected: true })).toBeOnTheScreen()
    expect(screen.getByRole("header", { name: "Reservar" })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("tab", { name: "Plan" }))
    expect(mockReplace).toHaveBeenCalledWith("/entrenamiento")
  })

  it("sin conexión el cliente solo ve Plan y Nutrición, que tienen copia guardada", async () => {
    entrarComo("cliente", "local")
    mockRuta.actual = "/entrenamiento"
    await render(
      <Armazon>
        <Text>Contenido</Text>
      </Armazon>,
    )
    expect(pestanas()).toEqual(["Plan", "Nutrición"])
  })

  it("en escritorio el entrenador tiene la Agenda en la barra lateral", async () => {
    entrarComo("entrenador")
    mockAncho.actual = 1280
    mockRuta.actual = "/agenda"
    await render(
      <Armazon>
        <Text>Contenido</Text>
      </Armazon>,
    )
    expect(pestanas()).toEqual([
      "Hoy",
      "Agenda",
      "Clientes",
      "Rutinas",
      "Ejercicios",
      "Nutricionista",
    ])
    expect(screen.getByRole("tab", { name: "Agenda", selected: true })).toBeOnTheScreen()
    expect(screen.getByRole("header", { name: "Agenda" })).toBeOnTheScreen()
  })
})
