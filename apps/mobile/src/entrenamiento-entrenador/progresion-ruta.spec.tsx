import { render, screen } from "@testing-library/react-native"
import ProgresionDelEjercicio from "../../app/entrenador/cliente/[id]/ejercicio/[ejercicioId]"
import { ProgresionEjercicio } from "./ficha/progresion-ejercicio"

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => false),
}
let mockRol = "entrenador"
const mockPedir = jest.fn()
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "cliente", ejercicioId: "press" }),
  useRouter: () => mockRouter,
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { id: "cuenta", rol: mockRol } },
    pedir: mockPedir,
  }),
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../seguimiento/use-seguimiento", () => ({ useSeguimiento: () => ({}) }))
jest.mock("./ficha/progresion-ejercicio", () => ({ ProgresionEjercicio: jest.fn(() => null) }))

it("conecta la ficha, el ajuste de RIR y la revisión con el cliente y ejercicio correctos", async () => {
  mockRol = "entrenador"
  await render(<ProgresionDelEjercicio />)
  const props = jest.mocked(ProgresionEjercicio).mock.calls.at(-1)![0]
  expect(props).toMatchObject({ clienteId: "cliente", ejercicioId: "press" })
  props.volver()
  expect(mockRouter.replace).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "cliente", pestana: "progreso" },
  })
  props.ajustar("press")
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]/plan",
    params: { id: "cliente", ejercicioId: "press" },
  })
  props.abrirSesion("sesion", "David García")
  expect(mockRouter.push).toHaveBeenCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: "sesion", nombre: "David García" },
  })
})

it.each(["cliente", "nutricionista"])(
  "no monta historial del entrenador con rol %s",
  async (rol) => {
    mockRol = rol
    await render(<ProgresionDelEjercicio />)
    expect(screen.getByText("Esta pantalla requiere una cuenta de entrenador.")).toBeOnTheScreen()
    expect(ProgresionEjercicio).not.toHaveBeenCalled()
  },
)
