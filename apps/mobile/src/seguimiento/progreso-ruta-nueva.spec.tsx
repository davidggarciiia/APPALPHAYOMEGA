import { render, screen } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL } from "@alpha-omega/shared"

import Progreso from "../../app/progreso"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-000000000001" }))

let mockCliente = "cliente-a"
const mockSeguimiento = {
  configuracion: jest.fn(async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["peso" as const],
  })),
  dias: jest.fn(async () => ({ dias: [] })),
  medidas: jest.fn(async (clienteId: string) =>
    clienteId === "cliente-a"
      ? {
          medidas: [
            {
              id: "40000000-0000-4000-8000-000000000001",
              fecha: "2026-01-10",
              pesoKg: 80,
              cinturaCm: null,
              grasaPct: null,
              alturaCm: null,
              creadoEn: "2026-01-10T08:00:00.000Z",
            },
          ],
          fechaNacimiento: null,
        }
      : { medidas: [], fechaNacimiento: null },
  ),
  fuerza: jest.fn(async () => ({ ejercicios: [] })),
  pruebas: jest.fn(async () => ({ pruebas: [] })),
}
const mockEntrenamiento = {
  plan: jest.fn(async () => ({ plan: null })),
  semana: jest.fn(async () => ({ sesiones: [], total: 0 })),
}
const mockValoraciones = {
  evolucion: jest.fn(async () => ({ series: [] })),
  listarPublicadas: jest.fn(async () => ({ valoraciones: [], total: 0 })),
  proximaRevision: jest.fn(async () => ({
    revision: 0,
    pauta: null,
    cumplidaPorId: null,
    actualizadaEn: null,
  })),
}
const mockMedios = {
  fotosDeCliente: jest.fn(async () => ({ fotos: [] })),
  solicitudes: jest.fn(async () => ({ solicitudes: [] })),
}
jest.mock("../sesion", () => ({
  useSesion: () => ({ estado: { fase: "dentro", usuario: { id: mockCliente, rol: "cliente" } } }),
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({
  useEntrenamiento: () => mockEntrenamiento,
}))
jest.mock("./use-seguimiento", () => ({ useSeguimiento: () => mockSeguimiento }))
jest.mock("./use-valoraciones", () => ({ useValoraciones: () => mockValoraciones }))
jest.mock("./use-medios", () => ({ useMedios: () => mockMedios }))

beforeEach(() => {
  mockCliente = "cliente-a"
})

it("la ruta del cliente carga la vista rediseñada con sus datos", async () => {
  await render(<Progreso />)
  expect(await screen.findByRole("button", { name: /^Peso, 80 kg/ })).toBeOnTheScreen()
  expect(screen.queryAllByRole("tab")).toHaveLength(0)
  expect(mockSeguimiento.medidas).toHaveBeenCalledWith("cliente-a")
})

it("al cambiar de cuenta retira los datos anteriores mientras carga la nueva", async () => {
  mockSeguimiento.medidas.mockImplementation(async (clienteId) =>
    clienteId === "cliente-a"
      ? {
          medidas: [
            {
              id: "40000000-0000-4000-8000-000000000001",
              fecha: "2026-01-10",
              pesoKg: 80,
              cinturaCm: null,
              grasaPct: null,
              alturaCm: null,
              creadoEn: "2026-01-10T08:00:00.000Z",
            },
          ],
          fechaNacimiento: null,
        }
      : new Promise(() => undefined),
  )
  const vista = await render(<Progreso />)
  expect(await screen.findByRole("button", { name: /^Peso, 80 kg/ })).toBeOnTheScreen()
  mockCliente = "cliente-b"
  await vista.rerender(<Progreso />)
  expect(mockSeguimiento.medidas).toHaveBeenCalledWith("cliente-b")
  expect(screen.queryByRole("button", { name: /^Peso,/ })).toBeNull()
  expect(screen.queryByText("80")).toBeNull()
})
