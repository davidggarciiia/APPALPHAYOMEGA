import { render, screen } from "@testing-library/react-native"
import type { ListadoResultados } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { EjerciciosRevision } from "./ejercicios-revision"

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

// Sustituye «la revisión observa $estado frente a la última semana con datos».
it.each([
  { pesos: [60, 57.5], estado: "Progresa" },
  { pesos: [60, 60], estado: null },
  { pesos: [60, 62.5], estado: null },
  { pesos: [60, 60, 60], estado: "Estancado" },
  { pesos: [60, 62.5, 65], estado: "Baja" },
  { pesos: [80, 60, 60, 60], estado: "Estancado", revisar: 1 },
  { pesos: [80, 60, 60, 60], estado: "Estancado", revisar: 1, mismoDia: true },
])(
  "la revisión observa $estado con las sesiones anteriores (revisar: $revisar, mismo día: $mismoDia)",
  async ({ pesos, estado, revisar = 0, mismoDia = false }) => {
    const resultados = pesos.map((pesoKg, i) => ({
      agenda: { fechaActual: mismoDia ? "2026-10-28" : `2026-10-${28 - i}` },
      resultado: {
        sesionId: `sesion-${i}`,
        enviadoEn: mismoDia ? `2026-10-28T${15 - i}:00:00Z` : `2026-10-${28 - i}T12:00:00Z`,
        revisionPrescripcion: 0,
        notas: null,
        prescripcion: {
          nombre: "Empuje",
          ejercicios: [
            {
              id: "prescrito",
              ejercicioId: "press",
              nombre: "Press inclinado",
              seccion: "principal",
              indicaciones: null,
              tipoCarga: "conCargaExterna",
              rir: { min: 2, max: 2 },
              series: [
                {
                  id: "serie",
                  tipoMedicion: "repeticiones",
                  pesoKg: 60,
                  repeticiones: 8,
                  repeticionesMax: 10,
                },
              ],
            },
            {
              id: "aproximacion",
              ejercicioId: "calentamiento",
              nombre: "Aproximaciones",
              seccion: "calentamiento",
              indicaciones: null,
              series: [{ id: "cal", tipoMedicion: "repeticiones", pesoKg: 100, repeticiones: 10 }],
            },
          ],
        },
        series: [
          {
            serieId: "serie",
            hecha: true,
            valores: { tipoMedicion: "repeticiones", pesoKg, repeticiones: 10, rir: null },
          },
          {
            serieId: "cal",
            hecha: true,
            valores: { tipoMedicion: "repeticiones", pesoKg: i === 0 ? 100 : 50, repeticiones: 10 },
          },
        ],
      },
    })) as ListadoResultados["resultados"]
    const api = {
      comentarios: async () => ({ comentarios: [] }),
      molestias: async () => ({ molestias: [], total: 0 }),
      resultados: jest.fn(async () => ({ resultados })),
    } as unknown as ApiEntrenamiento
    await render(
      <EjerciciosRevision
        resultado={resultados[revisar]!.resultado}
        clienteId="cliente"
        nombreCliente="David"
        api={api}
        sinAcceso={jest.fn()}
      />,
    )
    if (estado) {
      expect(await screen.findByText(estado)).toBeOnTheScreen()
      expect(screen.getAllByText(estado)).toHaveLength(1)
    } else {
      expect(await screen.findByText("Press inclinado")).toBeOnTheScreen()
      expect(screen.queryByText(/^(Progresa|Estancado|Baja)$/)).toBeNull()
    }
    expect(screen.queryByText(/Próxima vez|Sube/)).toBeNull()
    expect(api.resultados).toHaveBeenCalledWith("cliente", 60)
  },
)
