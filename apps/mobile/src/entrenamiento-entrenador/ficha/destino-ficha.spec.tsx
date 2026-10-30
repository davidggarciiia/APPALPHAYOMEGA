import { fireEvent, render, screen } from "@testing-library/react-native"
import type { Molestia } from "@alpha-omega/shared"
import Sesiones from "../../../app/entrenador/cliente/[id]/sesiones"
import Progreso from "../../../app/entrenador/cliente/[id]/progreso"
import Valoraciones from "../../../app/entrenador/cliente/[id]/valoraciones"
import Molestias from "../../../app/entrenador/cliente/[id]/molestias"
import { useDatosFicha } from "./use-datos-ficha"

const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockRol = "entrenador"
let mockDatos = {
  ficha: { nombre: "David", apellidos: "García", fechaNacimiento: "1990-01-01" },
  resultados: [],
  molestias: [] as Molestia[],
}
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "cliente", valoracionInicial: "1", sinRevisar: "1" }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => false,
    back: jest.fn(),
  }),
}))
jest.mock("../../sesion", () => ({
  useSesion: () => ({
    estado: { fase: "dentro", usuario: { id: "entrenador", rol: mockRol } },
    pedir: jest.fn(),
  }),
}))
jest.mock("../../entrenamiento/use-entrenamiento", () => ({ useEntrenamiento: () => ({}) }))
jest.mock("../../seguimiento/use-seguimiento", () => ({ useSeguimiento: () => ({}) }))
jest.mock("../../seguimiento/use-medios", () => ({ useMedios: () => ({}) }))
jest.mock("../../seguimiento/use-valoraciones", () => ({ useValoraciones: () => ({}) }))
jest.mock("../../nutricion/api", () => ({ useNutricion: () => ({}) }))
jest.mock("./use-datos-ficha", () => ({
  useDatosFicha: jest.fn(() => ({
    datos: mockDatos,
    error: "",
    copia: "",
    responder: jest.fn(),
    sinAcceso: jest.fn(),
    reintentar: jest.fn(),
  })),
}))
jest.mock("./sesiones", () => ({
  SesionesDelCliente: (props: { sinRevisarInicial: boolean }) => {
    const { Text } = jest.requireActual<typeof import("react-native")>("react-native")
    return <Text>{props.sinRevisarInicial ? "Sesiones sin revisar" : "Todas las sesiones"}</Text>
  },
}))
jest.mock("../../seguimiento/progreso", () => ({
  ProgresoCliente: (props: { modo: string; abrirEjercicio: (id: string) => void }) => {
    const { Text, Pressable } = jest.requireActual<typeof import("react-native")>("react-native")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir press"
        onPress={() => props.abrirEjercicio("press")}
      >
        <Text>Progreso {props.modo}</Text>
      </Pressable>
    )
  },
}))
jest.mock("../../seguimiento/editor-valoracion", () => ({
  ValoracionesProfesional: (props: {
    iniciarInicial: boolean
    fechaNacimiento: string
    alEditar: (editando: boolean) => void
  }) => {
    const React = jest.requireActual<typeof import("react")>("react")
    const { Text, TextInput } = jest.requireActual<typeof import("react-native")>("react-native")
    const [valor, cambiar] = React.useState("")
    React.useEffect(() => props.alEditar(valor !== ""), [valor, props.alEditar])
    return (
      <>
        <Text>{props.iniciarInicial ? `Inicial ${props.fechaNacimiento}` : "Valoraciones"}</Text>
        <TextInput
          accessibilityLabel="Borrador de valoración"
          value={valor}
          onChangeText={cambiar}
        />
      </>
    )
  },
}))
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

beforeEach(() => {
  mockRol = "entrenador"
  mockDatos = { ...mockDatos, molestias: [] }
})

it("abre sesiones con el filtro solicitado, sin pestañas de ficha", async () => {
  await render(<Sesiones />)
  expect(screen.getByText("Todas las sesiones")).toBeOnTheScreen()
  expect(screen.queryByText(/sin revisar/i)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la ficha" }))
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "cliente" },
  })
})

it("la pantalla Progreso abre el ejercicio y conserva el modo profesional", async () => {
  await render(<Progreso />)
  expect(screen.getByText("Progreso entrenador")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Abrir press" }))
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]/ejercicio/[ejercicioId]",
    params: { id: "cliente", ejercicioId: "press" },
  })
})

it("abre la valoración inicial independiente y conserva su borrador al refrescar datos", async () => {
  await render(<Valoraciones />)
  expect(screen.getByText("Inicial 1990-01-01")).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText("Borrador de valoración"), "78,5")
  mockDatos = { ...mockDatos, ficha: { ...mockDatos.ficha } }
  await screen.rerender(<Valoraciones />)
  expect(screen.getByLabelText("Borrador de valoración")).toHaveProp("value", "78,5")
  await fireEvent.press(screen.getByRole("button", { name: "Volver a la ficha" }))
  expect(screen.getByText("¿Salir sin guardar?")).toBeOnTheScreen()
  expect(mockReplace).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Seguir editando" }))
  expect(screen.getByLabelText("Borrador de valoración")).toHaveProp("value", "78,5")
})

it("muestra el vacío de molestias y no carga datos con un rol ajeno", async () => {
  await render(<Molestias />)
  expect(screen.getByText("Sin molestias registradas.")).toBeOnTheScreen()
  jest.mocked(useDatosFicha).mockClear()
  mockRol = "cliente"
  await screen.rerender(<Molestias />)
  expect(screen.getByText("Esta pantalla requiere una cuenta de entrenador.")).toBeOnTheScreen()
  expect(useDatosFicha).not.toHaveBeenCalled()
})

it("Ver sesión usa el id de la molestia aunque su sesión no esté en el historial cargado", async () => {
  mockDatos = {
    ...mockDatos,
    molestias: [
      {
        id: "molestia",
        sesionId: "sesion-fuera-historial",
        clienteId: "cliente",
        ejercicioPrescritoId: "otro-ejercicio",
        zona: "hombro",
        intensidad: 7,
        nivel: "rojo",
        sintomas: [],
        ejercicio: "Press inclinado",
        serie: 2,
        nota: null,
        estado: "abierta",
        creadaEn: "2026-10-26T12:00:00Z",
        respuesta: null,
        atendidaEn: null,
      },
    ],
  }
  await render(<Molestias />)
  await fireEvent.press(screen.getByRole("button", { name: "Ver sesión" }))
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/entrenamiento/[id]",
    params: { id: "sesion-fuera-historial", nombre: "David García" },
  })
})
