import { describe, expect, it, jest } from "@jest/globals"
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { CambiarDia, DiaDeSeguimiento } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda, lunesDeSemana, sumarDias } from "../entrenamiento/fechas"
import type { ApiSeguimiento } from "./api"
import { HoyDiario } from "./hoy-diario"
import { ProgresoCliente } from "./progreso"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("expo-crypto", () => ({ randomUUID: () => "30000000-0000-4000-8000-000000000001" }))

const CLIENTE = "10000000-0000-4000-8000-000000000000"

function api(dias: DiaDeSeguimiento[] = []): ApiSeguimiento {
  return {
    cambiarDia: jest.fn(async (_c: string, fecha: string, cambio: CambiarDia) => ({
      fecha,
      pesoKg: null,
      pasos: null,
      suenoMin: null,
      creatina: null,
      ...dias[0],
      ...cambio,
    })),
    dias: jest.fn(async () => ({ dias })),
    medidas: jest.fn(async () => ({ medidas: [], fechaNacimiento: null })),
    registrarMedida: jest.fn(async () => {
      throw new Error("no usado")
    }),
    pruebas: jest.fn(async () => ({ pruebas: [] })),
    registrarPrueba: jest.fn(async () => {
      throw new Error("no usado")
    }),
    fuerza: jest.fn(async () => ({ ejercicios: [] })),
  }
}

describe("HoyDiario", () => {
  it("enseña lo apuntado hoy con el objetivo de pasos", async () => {
    const hoy = hoyAgenda()
    await render(
      <HoyDiario
        clienteId={CLIENTE}
        api={api([{ fecha: hoy, pesoKg: 111.6, pasos: 3240, suenoMin: 460, creatina: null }])}
        objetivoPasos={7000}
      />,
    )
    await waitFor(() => expect(screen.getByText("111,6 kg")).toBeTruthy())
    expect(screen.getByText("3.240 / 7.000")).toBeTruthy()
    expect(screen.getByText("7 h 40")).toBeTruthy()
  })

  it("apunta el peso con coma y marca la creatina", async () => {
    const seguimiento = api()
    await render(<HoyDiario clienteId={CLIENTE} api={seguimiento} objetivoPasos={null} />)
    await fireEvent.press(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "111,6")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() =>
      expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { pesoKg: 111.6 }),
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: "Creatina tomada" }))
    await waitFor(() =>
      expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { creatina: true }),
    )
  })

  it("no envía un peso imposible", async () => {
    const seguimiento = api()
    await render(<HoyDiario clienteId={CLIENTE} api={seguimiento} objetivoPasos={null} />)
    await fireEvent.press(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
    await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "1116")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Escribe un peso entre 30 y 400 kg.")).toBeTruthy()
    expect(seguimiento.cambiarDia).not.toHaveBeenCalled()
  })
})

describe("ProgresoCliente", () => {
  it("peso: media semanal, cambio desde el inicio y resumen de la semana", async () => {
    const hoy = hoyAgenda()
    const lunes = lunesDeSemana(hoy)
    const dias = [0, 1, 2].map((n) => ({
      fecha: sumarDias(hoy, n - 2),
      pesoKg: [112.1, 112.1, 111.6][n]!,
      pasos: 6000,
      suenoMin: 480,
      creatina: null,
    }))
    const seguimiento = api(dias)
    seguimiento.medidas = jest.fn(async () => ({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: sumarDias(hoy, -3),
          pesoKg: 112.2,
          cinturaCm: 109,
          grasaPct: 29.2,
          alturaCm: 196,
          creadoEn: new Date().toISOString(),
        },
      ],
      fechaNacimiento: "2005-03-10",
    }))
    const entrenamiento = {
      plan: jest.fn(async () => ({ plan: null })),
      semana: jest.fn(async () => ({ sesiones: [], total: 0 })),
    } as unknown as ApiEntrenamiento

    await render(
      <ProgresoCliente
        clienteId={CLIENTE}
        seguimiento={seguimiento}
        entrenamiento={entrenamiento}
      />,
    )
    await waitFor(() => expect(screen.getByText("111,9 kg")).toBeTruthy())
    expect(screen.getByText(/−0,3 kg respecto al inicio/)).toBeTruthy()
    expect(screen.getByText("Masa libre de grasa")).toBeTruthy()
    expect(screen.getByText("79,4 kg")).toBeTruthy()
    expect(screen.getByText(/196 cm · \d+ años/)).toBeTruthy()
    expect(entrenamiento.plan).toHaveBeenCalledWith(CLIENTE, lunes)

    await fireEvent.press(screen.getByRole("tab", { name: "Fuerza" }))
    expect(screen.getByText(/Cuando envíes sesiones con carga/)).toBeTruthy()
  })
})
