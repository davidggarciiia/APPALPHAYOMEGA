import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { RutinaGuardadaSchema, type RutinaGuardada } from "@alpha-omega/shared"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import type { ApiRutinas } from "./api-rutinas"
import { EditorRutina } from "./editor-rutina"

jest.mock("expo-router/react-navigation", () => ({
  NavigationContext: jest.requireActual<typeof import("react")>("react").createContext(null),
  usePreventRemove: () => undefined,
}))

const PRESS = ejercicioDePrueba("10000000-0000-4000-8000-000000000001", "Press", "pecho")

const RUTINA: RutinaGuardada = RutinaGuardadaSchema.parse({
  id: "20000000-0000-4000-8000-000000000001",
  nombre: "Pierna",
  revision: 1,
  patron: {
    sesiones: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        nombre: "Empuje",
        diaSemana: 1,
        ejercicios: [
          {
            id: "40000000-0000-4000-8000-000000000002",
            ejercicioId: PRESS.id,
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

function api(leer: ApiRutinas["leer"]): ApiRutinas {
  return { listar: jest.fn(), leer, crear: jest.fn(), editar: jest.fn() }
}

it("mientras carga la rutina muestra un esqueleto y no un texto suelto", async () => {
  let resolver!: (rutina: RutinaGuardada) => void
  const leer = jest.fn(() => new Promise<RutinaGuardada>((resolve) => (resolver = resolve)))
  await render(
    <EditorRutina
      id={RUTINA.id}
      api={api(leer)}
      catalogo={catalogoEnMemoria([PRESS])}
      terminado={jest.fn()}
    />,
  )
  expect(screen.getByRole("progressbar", { name: "Cargando rutina" })).toBeOnTheScreen()
  expect(screen.queryByText("Cargando…")).toBeNull()
  expect(screen.queryByRole("button", { name: "Guardar rutina" })).toBeNull()

  await act(async () => resolver(RUTINA))
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(screen.getByLabelText("Nombre de la rutina")).toHaveDisplayValue("Pierna")
})

it("si falla la carga no finge que sigue cargando: avisa y ofrece recargar sin dejar guardar", async () => {
  const leer = jest.fn().mockRejectedValueOnce(new Error("Sin red")).mockResolvedValue(RUTINA)
  await render(
    <EditorRutina
      id={RUTINA.id}
      api={api(leer)}
      catalogo={catalogoEnMemoria([PRESS])}
      terminado={jest.fn()}
    />,
  )
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No se pudo cargar la rutina. Reintenta.",
  )
  expect(screen.queryByRole("progressbar")).toBeNull()
  expect(screen.queryByRole("button", { name: "Guardar rutina" })).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Recargar rutina del servidor" }))
  expect(await screen.findByLabelText("Nombre de la rutina")).toHaveDisplayValue("Pierna")
  expect(screen.queryByRole("alert")).toBeNull()
})
