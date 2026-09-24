import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { AppState } from "react-native"
import {
  SeriePrescritaDistanciaSchema,
  ValoresEjecutadosDistanciaSchema,
} from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { DetalleEntrenador } from "./detalle"

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../entrenamiento/fecha-sesion", () => ({ FechaSesion: () => null }))
jest.mock("../entrenamiento/resultado", () => ({ PrescripcionVisible: jest.fn(() => null) }))

const sesion = {
  agenda: {
    id: "10000000-0000-4000-8000-000000000000",
    clienteId: "20000000-0000-4000-8000-000000000000",
    fechaOriginal: "2026-09-24",
    fechaActual: "2026-09-24",
    estado: "cerrada",
    revision: 1,
  },
  prescripcion: { nombre: "Fuerza", ejercicios: [] },
  revisionPrescripcion: 1,
  permiteAjuste: false,
  enviadoEn: "2026-09-24T10:00:00.000Z",
  revisadaEn: null,
}

it("solo marca revisada la sesión cuando el entrenador lo solicita", async () => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
  const leerEntrenador = jest.fn(async () => sesion)
  const revisar = jest.fn(async () => ({ ...sesion, revisadaEn: "2026-09-24T11:00:00.000Z" }))
  const api = {
    leerEntrenador,
    revisar,
    resultado: jest.fn(async () => ({})),
  } as unknown as ApiEntrenamiento
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  await waitFor(() => expect(screen.getByText("Fuerza")).toBeTruthy())
  expect(revisar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
  await waitFor(() => expect(revisar).toHaveBeenCalledWith(sesion.agenda.id))
  expect(screen.getByText(/Revisado/)).toBeTruthy()
})

it("lee un resultado en metros como metros, con su carga (D01, aún sin publicar)", async () => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
  const real = jest.requireActual<typeof import("../entrenamiento/resultado")>(
    "../entrenamiento/resultado",
  )
  // Aquí sí se pinta el resumen real; al terminar vuelve el simulado vacío.
  const resumen = jest.mocked(PrescripcionVisible)
  const vacio = resumen.getMockImplementation()!
  resumen.mockImplementation(real.PrescripcionVisible)
  const [primera, segunda] = [
    "30000000-0000-4000-8000-000000000001",
    "30000000-0000-4000-8000-000000000002",
  ].map((id) =>
    SeriePrescritaDistanciaSchema.parse({ id, tipoMedicion: "distancia", pesoKg: 32, metros: 20 }),
  )
  const prescripcion = {
    nombre: "Transportes",
    ejercicios: [
      {
        id: "30000000-0000-4000-8000-000000000003",
        ejercicioId: "30000000-0000-4000-8000-000000000004",
        nombre: "Paseo del granjero",
        indicaciones: null,
        tipoCarga: "conCargaExterna",
        series: [primera, segunda],
      },
    ],
  }
  const resultado = {
    sesionId: sesion.agenda.id,
    prescripcion,
    revisionPrescripcion: 1,
    enviadoEn: sesion.enviadoEn,
    notas: null,
    series: [
      {
        serieId: primera!.id,
        hecha: true,
        valores: ValoresEjecutadosDistanciaSchema.parse({
          tipoMedicion: "distancia",
          pesoKg: 34,
          metros: 18,
          rir: null,
        }),
      },
      { serieId: segunda!.id, hecha: false, omitida: true },
    ],
  }
  const api = {
    leerEntrenador: jest.fn(async () => ({ ...sesion, prescripcion })),
    resultado: jest.fn(async () => resultado),
    revisar: jest.fn(),
  } as unknown as ApiEntrenamiento
  try {
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await waitFor(() => expect(screen.getByText("Hecho: 18 m · 34 kg")).toBeTruthy())
    expect(screen.getByText("Serie 1 · Objetivo: 20 m · 32 kg")).toBeTruthy()
    expect(screen.getByText("Serie 2 · Objetivo: 20 m · 32 kg")).toBeTruthy()
    expect(screen.getByText("Omitida")).toBeTruthy()
    expect(screen.getByText("1/2")).toBeTruthy()
    expect(screen.queryByText(/rep/)).toBeNull()
  } finally {
    resumen.mockImplementation(vacio)
  }
})
