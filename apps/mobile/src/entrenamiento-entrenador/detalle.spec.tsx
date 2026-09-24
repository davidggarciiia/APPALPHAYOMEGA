import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { AppState } from "react-native"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { DetalleEntrenador } from "./detalle"

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../entrenamiento/fecha-sesion", () => ({ FechaSesion: () => null }))
jest.mock("../entrenamiento/resultado", () => ({ PrescripcionVisible: () => null }))

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
