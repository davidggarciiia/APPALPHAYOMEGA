import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { SesionEntrenador } from "@alpha-omega/shared"
import AjustarSesion from "../../app/entrenador/sesion/[id]/ajustar"

const mockBack = jest.fn()
const mockLeer = jest.fn()
const mockAjustar = jest.fn()
const mockApi = { leerEntrenador: mockLeer, ajustar: mockAjustar }
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "10000000-0000-4000-8000-000000000001" }),
  useRouter: () => ({ back: mockBack }),
}))
jest.mock("../entrenamiento/use-entrenamiento", () => ({
  useEntrenamiento: () => mockApi,
}))
jest.mock("../catalogo-ejercicios/use-catalogo", () => ({ useCatalogo: () => ({}) }))
jest.mock("./selector-ejercicios", () => ({ SelectorEjercicios: () => null }))
jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID(),
}))

it("ajustar una carga conserva toda la información de la sesión publicada", async () => {
  const original: SesionEntrenador = {
    agenda: {
      id: "10000000-0000-4000-8000-000000000001",
      clienteId: "20000000-0000-4000-8000-000000000001",
      fechaOriginal: "2026-10-26",
      fechaActual: "2026-10-26",
      estado: "abierta",
      revision: 0,
    },
    revisionPrescripcion: 2,
    permiteAjuste: true,
    enviadoEn: null,
    prescripcion: {
      nombre: "Empuje",
      duracion: "50 min",
      nota: "Mantén el ritmo",
      partes: { calentamiento: "5", fuerza: "35", cardio: "5", calma: "5" },
      circuito: { nombre: "Core", vueltas: 2, descanso: "60 s" },
      ejercicios: [
        {
          id: "30000000-0000-4000-8000-000000000001",
          ejercicioId: "40000000-0000-4000-8000-000000000001",
          nombre: "Press",
          indicaciones: null,
          series: [
            {
              id: "50000000-0000-4000-8000-000000000001",
              tipoMedicion: "repeticiones",
              repeticiones: 8,
              pesoKg: 40,
            },
          ],
        },
      ],
    },
  }
  mockLeer.mockResolvedValue(original)
  mockAjustar.mockResolvedValue(original)
  await render(<AjustarSesion />)
  await fireEvent.changeText(
    await screen.findByLabelText("Peso kg — Press, serie 1 (opcional)"),
    "42",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Guardar ajuste" }))
  await waitFor(() => expect(mockAjustar).toHaveBeenCalled())
  expect(mockAjustar.mock.calls[0]![1]).toMatchObject({
    duracion: original.prescripcion.duracion,
    nota: original.prescripcion.nota,
    partes: original.prescripcion.partes,
    circuito: original.prescripcion.circuito,
  })
})
