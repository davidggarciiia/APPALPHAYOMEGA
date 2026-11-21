import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  RutinaGuardadaSchema,
  type EditarRutina,
  type GuardarRutina,
  type RutinaGuardada,
} from "@alpha-omega/shared"
import { duplicarRutina } from "./api-rutinas"
import { ListadoDeRutinas } from "./listado-rutinas"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const rutina = (id: string, nombre: string): RutinaGuardada =>
  RutinaGuardadaSchema.parse({
    id,
    nombre,
    revision: 3,
    patron: {
      sesiones: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          nombre: "Empuje",
          diaSemana: 1,
          ejercicios: [
            {
              id: "40000000-0000-4000-8000-000000000002",
              ejercicioId: "10000000-0000-4000-8000-000000000001",
              indicaciones: null,
              series: [
                {
                  id: "40000000-0000-4000-8000-000000000003",
                  pesoKg: null,
                  tipoMedicion: "repeticiones",
                  repeticiones: 8,
                },
              ],
            },
          ],
        },
      ],
    },
  })

const PIERNA = rutina("20000000-0000-4000-8000-000000000001", "Pierna")

function apiConRutinas(rutinas: RutinaGuardada[] = [PIERNA]) {
  return {
    listar: jest.fn(async () => ({ rutinas, total: rutinas.length })),
    leer: jest.fn(async (id: string) => rutinas.find((r) => r.id === id)!),
    crear: jest.fn(async (datos: GuardarRutina) =>
      RutinaGuardadaSchema.parse({
        ...datos,
        id: "20000000-0000-4000-8000-0000000000ff",
        revision: 0,
      }),
    ),
    editar: jest.fn<Promise<RutinaGuardada>, [string, EditarRutina]>(),
  }
}

async function avanzar(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("muestra un esqueleto de carga, no un texto suelto", async () => {
  await render(<ListadoDeRutinas api={apiConRutinas()} elegir={jest.fn()} />)
  expect(screen.getByRole("progressbar", { name: "Cargando rutinas" })).toBeOnTheScreen()
  expect(screen.queryByText("Cargando rutinas…")).toBeNull()
  await avanzar(250)
  expect(screen.queryByRole("progressbar")).toBeNull()
})

it("al elegir una rutina como punto de partida el botón dice «Elegir»", async () => {
  const elegir = jest.fn()
  await render(<ListadoDeRutinas api={apiConRutinas()} elegir={elegir} />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Elegir Pierna" }))
  expect(elegir).toHaveBeenCalledWith(PIERNA)
  expect(screen.queryByRole("button", { name: "Editar Pierna" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Duplicar Pierna" })).toBeNull()
})

it("en modo editar el botón dice «Editar» y se puede duplicar", async () => {
  const elegir = jest.fn()
  await render(<ListadoDeRutinas api={apiConRutinas()} elegir={elegir} modo="editar" />)
  await avanzar(250)
  expect(screen.queryByRole("button", { name: "Elegir Pierna" })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Editar Pierna" }))
  expect(elegir).toHaveBeenCalledWith(PIERNA)
  expect(screen.getByRole("button", { name: "Duplicar Pierna" })).toBeOnTheScreen()
})

it("duplicar crea una rutina nueva «(copia)» con el mismo patrón y recarga la lista", async () => {
  const api = apiConRutinas()
  await render(<ListadoDeRutinas api={api} elegir={jest.fn()} modo="editar" />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Duplicar Pierna" }))
  await avanzar(0)
  expect(api.leer).toHaveBeenCalledWith(PIERNA.id)
  expect(api.crear).toHaveBeenCalledTimes(1)
  expect(api.crear).toHaveBeenCalledWith({ nombre: "Pierna (copia)", patron: PIERNA.patron })
  expect(api.editar).not.toHaveBeenCalled()
  expect(screen.getByText("Rutina duplicada: «Pierna (copia)».")).toBeOnTheScreen()
  await avanzar(250)
  expect(api.listar).toHaveBeenCalledTimes(2)
})

it("un segundo toque mientras se duplica no crea otra copia", async () => {
  const api = apiConRutinas()
  let terminar!: () => void
  api.leer.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        terminar = () => resolve(PIERNA)
      }),
  )
  await render(<ListadoDeRutinas api={api} elegir={jest.fn()} modo="editar" />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Duplicar Pierna" }))
  await fireEvent.press(screen.getByRole("button", { name: "Duplicar Pierna" }))
  await act(async () => terminar())
  expect(api.leer).toHaveBeenCalledTimes(1)
  expect(api.crear).toHaveBeenCalledTimes(1)
})

it("si no se puede duplicar lo dice y no anuncia una copia", async () => {
  const api = apiConRutinas()
  api.crear.mockRejectedValueOnce(new Error("Ejercicio retirado"))
  await render(<ListadoDeRutinas api={api} elegir={jest.fn()} modo="editar" />)
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Duplicar Pierna" }))
  await avanzar(0)
  expect(screen.getByRole("alert")).toHaveTextContent(/No se pudo duplicar «Pierna»/)
  expect(screen.queryByText(/Rutina duplicada/)).toBeNull()
  expect(screen.getByRole("button", { name: "Duplicar Pierna" })).toBeEnabled()
})

describe("duplicarRutina", () => {
  it("recorta el nombre para que la marca quepa en 120 caracteres", async () => {
    const larga = rutina("20000000-0000-4000-8000-000000000002", "x".repeat(120))
    const api = apiConRutinas([larga])
    await duplicarRutina(api, larga.id)
    const { nombre } = api.crear.mock.calls[0]![0]
    expect(nombre).toHaveLength(120)
    expect(nombre.endsWith(" (copia)")).toBe(true)
  })
})
