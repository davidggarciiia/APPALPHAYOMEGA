import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { CambiarDia, DiaDeSeguimiento, DocumentoDieta } from "@alpha-omega/shared"

import { hoyAgenda } from "../entrenamiento/fechas"
import type { ApiSeguimiento } from "../seguimiento/api"
import type { ApiNutricion } from "./api"
import { HoyInicio } from "./hoy-inicio"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const TIPO = "00000000-0000-4000-8000-000000000001"

function dieta(suplementos?: DocumentoDieta["suplementos"]): DocumentoDieta {
  return {
    formato: 1,
    nombre: "Plan",
    tiposDeDia: [
      {
        id: TIPO,
        nombre: "Todos los días",
        objetivo: { kcal: 2000, proteinaG: null, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    semana: Array(7).fill(TIPO),
    indicaciones: [],
    ...(suplementos ? { suplementos } : {}),
  }
}

function apis(documento: DocumentoDieta | null, inicial: DiaDeSeguimiento | null = null) {
  let dia = inicial
  const nutricion = {
    vigente: jest.fn(async () => ({
      dieta: documento
        ? {
            id: "30000000-0000-4000-8000-000000000000",
            clienteId: CLIENTE,
            documento,
            publicadaEn: "2026-09-24T08:00:00.000Z",
          }
        : null,
      deNutricionista: true,
    })),
  } satisfies Pick<ApiNutricion, "vigente">
  const seguimiento = {
    dias: jest.fn(async () => ({ dias: dia ? [dia] : [] })),
    cambiarDia: jest.fn(async (_clienteId: string, fecha: string, cambio: CambiarDia) => {
      dia = {
        fecha,
        pesoKg: null,
        pasos: null,
        suenoMin: null,
        creatina: null,
        suplementos: [],
        ...dia,
        ...cambio,
      }
      return dia
    }),
  } satisfies Pick<ApiSeguimiento, "dias" | "cambiarDia">
  return { nutricion, seguimiento }
}

it("sin suplementos publicados conserva Peso, Pasos y Sueño, sin creatina fija", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={7000}
    />,
  )
  expect(await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Pasos: sin apuntar. Cambiar" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Sueño: sin apuntar. Cambiar" })).toBeTruthy()
  expect(screen.queryByRole("checkbox", { name: "Creatina tomada" })).toBeNull()
})

it("sin dieta publicada no inventa suplementos y permite apuntar el peso", async () => {
  const { nutricion, seguimiento } = apis(null)
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "111,6")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  await waitFor(() =>
    expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { pesoKg: 111.6 }),
  )
  expect(screen.queryByRole("checkbox")).toBeNull()
})

it("Inicio muestra solo los suplementos de la dieta y usa el mismo registro que Nutrición", async () => {
  const { nutricion, seguimiento } = apis(
    dieta([
      { nombre: "Creatina monohidrato", dosis: "5 g" },
      { nombre: "Vitamina D", dosis: "1 cápsula" },
    ]),
  )
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await fireEvent.press(
    await screen.findByRole("checkbox", { name: "Creatina monohidrato tomada" }),
  )
  await waitFor(() =>
    expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), { creatina: true }),
  )
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D tomada" }))
  await waitFor(() =>
    expect(seguimiento.cambiarDia).toHaveBeenCalledWith(CLIENTE, hoyAgenda(), {
      suplementos: ["Vitamina D"],
    }),
  )
  expect(screen.getByText("5 g")).toBeTruthy()
  expect(screen.getByText("1 cápsula")).toBeTruthy()
})

it("respeta la creatina guardada en el campo antiguo al volver a Inicio", async () => {
  const { nutricion, seguimiento } = apis(dieta([{ nombre: "Creatina", dosis: null }]), {
    fecha: hoyAgenda(),
    pesoKg: null,
    pasos: null,
    suenoMin: null,
    creatina: true,
    suplementos: [],
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: "Creatina tomada" }).props.accessibilityState.checked,
    ).toBe(true),
  )
})
