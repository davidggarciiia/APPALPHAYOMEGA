import { render, screen } from "@testing-library/react-native"
import PrepararPlan from "../../app/entrenador/cliente/[id]/plan"

let mockParametros: { id: string; ejercicioId?: string } = { id: "cliente" }
const mockConstructor = jest.fn()
const mockAjuste = jest.fn()
const mockPedir = jest.fn().mockResolvedValue({ nombre: "David", apellidos: "García" })
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParametros,
  useRouter: () => ({ canGoBack: () => true, back: jest.fn() }),
}))
jest.mock("../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: "entrenador" } },
    pedir: mockPedir,
  }),
}))
jest.mock("../catalogo-ejercicios/use-catalogo", () => ({ useCatalogo: () => ({}) }))
jest.mock("../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../entrenamiento/almacen-dispositivo", () => ({ almacenDispositivo: {} }))
jest.mock("./api-rutinas", () => ({ useRutinas: () => ({}) }))
jest.mock("./constructor/constructor", () => ({
  ConstructorPlan: (props: unknown) => {
    mockConstructor(props)
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native")
    return <Text>Constructor</Text>
  },
}))
jest.mock(
  "./ajuste-ejercicio",
  () => ({
    AjusteEjercicio: (props: unknown) => {
      mockAjuste(props)
      const { Text } = jest.requireActual<typeof import("react-native")>("react-native")
      return <Text>Ajuste de RIR</Text>
    },
  }),
  { virtual: true },
)

it("con ejercicioId abre el ajuste del ejercicio sin iniciar una asignación nueva", async () => {
  mockParametros = { id: "cliente", ejercicioId: "press" }
  await render(<PrepararPlan />)
  expect(screen.getByText("Ajuste de RIR")).toBeOnTheScreen()
  expect(mockAjuste).toHaveBeenLastCalledWith(
    expect.objectContaining({ clienteId: "cliente", ejercicioId: "press" }),
  )
  expect(mockConstructor).not.toHaveBeenCalled()
})

it("sin ejercicioId conserva el constructor de una nueva asignación", async () => {
  mockParametros = { id: "cliente" }
  await render(<PrepararPlan />)
  expect(screen.getByText("Constructor")).toBeOnTheScreen()
  expect(mockAjuste).not.toHaveBeenCalled()
})
