import { render, screen } from "@testing-library/react-native"
import FichaDelCliente from "../../app/entrenador/cliente/[id]/index"

let mockParametros: {
  id: string
  valoracionInicial?: string
  pestana?: string
  datos?: string
  correoFallido?: string
} = {
  id: "10000000-0000-4000-8000-000000000001",
  valoracionInicial: "1",
}
const mockFicha = jest.fn()
const mockSetParams = jest.fn()
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParametros,
  useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }),
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: "entrenador" } },
    pedir: jest.fn(),
  }),
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../nutricion/api", () => ({ useNutricion: () => ({}) }))
jest.mock("../seguimiento/use-seguimiento", () => ({ useSeguimiento: () => ({}) }))
jest.mock("../seguimiento/use-medios", () => ({ useMedios: () => ({}) }))
jest.mock("../seguimiento/use-valoraciones", () => ({ useValoraciones: () => ({}) }))
jest.mock("./ficha/ficha-cliente", () => ({
  FichaCliente: (props: unknown) => {
    mockFicha(props)
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native")
    return <Text>Ficha profesional</Text>
  },
}))

it.each(["1", "0"])(
  "la ruta enlaza la entrada inicial solo con el parámetro 1 (%s)",
  async (valor) => {
    mockParametros = { ...mockParametros, valoracionInicial: valor }
    await render(<FichaDelCliente />)
    expect(screen.getByText("Ficha profesional")).toBeOnTheScreen()
    expect(mockFicha).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clienteId: mockParametros.id,
        valoracionInicial: valor === "1",
      }),
    )
  },
)

it("el enlace de datos conserva el fallo de correo y consume la apertura al cerrar", async () => {
  mockParametros = { id: mockParametros.id, datos: "1", correoFallido: "1" }
  await render(<FichaDelCliente />)
  const props = mockFicha.mock.lastCall![0] as { alCerrarDatos: () => void }
  expect(props).toEqual(expect.objectContaining({ datosIniciales: true, correoFallido: true }))
  props.alCerrarDatos()
  expect(mockSetParams).toHaveBeenCalledWith({ datos: "0", correoFallido: "0" })
})

it.each(["progreso", "resumen", "otra"])(
  "abre la pestaña solicitada por Notificaciones sin iniciar una valoración (%s)",
  async (pestana) => {
    mockParametros = { id: mockParametros.id, pestana }
    await render(<FichaDelCliente />)
    expect(mockFicha).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pestanaInicial: pestana === "progreso" ? "progreso" : undefined,
        valoracionInicial: false,
      }),
    )
  },
)
