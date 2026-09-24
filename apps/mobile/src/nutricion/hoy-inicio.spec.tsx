import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type CambiarDia,
  type DiaDeSeguimiento,
  type DocumentoDieta,
} from "@alpha-omega/shared"

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
    configuracion: jest.fn(async () => CONFIGURACION_SEGUIMIENTO_INICIAL),
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
  } satisfies Pick<ApiSeguimiento, "configuracion" | "dias" | "cambiarDia">
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

it("solo ofrece los indicadores visibles y solicitados por el entrenador, en su orden", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  seguimiento.configuracion.mockResolvedValue({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["sueno", "pasos"],
    registrosSolicitados: [
      { indicador: "peso", frecuencia: "diaria", diaSemana: null },
      { indicador: "pasos", frecuencia: "diaria", diaSemana: null },
      { indicador: "sueno", frecuencia: "diaria", diaSemana: null },
    ],
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await screen.findByRole("button", { name: "Sueño: sin apuntar. Cambiar" })
  expect(screen.queryByRole("button", { name: /^Peso:/ })).toBeNull()
  expect(screen.getAllByRole("button").map((boton) => boton.props.accessibilityLabel)).toEqual([
    "Sueño: sin apuntar. Cambiar",
    "Pasos: sin apuntar. Cambiar",
  ])
})

it("no solicita indicadores configurados como No pedir", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  seguimiento.configuracion.mockResolvedValue({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    registrosSolicitados: [],
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await waitFor(() => expect(seguimiento.configuracion).toHaveBeenCalled())
  expect(screen.queryByRole("button", { name: /sin apuntar/ })).toBeNull()
  expect(screen.getByText("Hoy no tienes registros pautados en esta pantalla.")).toBeTruthy()
})

it.each([true, false])("respeta el día semanal pautado (corresponde hoy: %s)", async (tocaHoy) => {
  const { nutricion, seguimiento } = apis(dieta())
  const diaSemana = new Date(`${hoyAgenda()}T00:00:00Z`).getUTCDay() || 7
  seguimiento.configuracion.mockResolvedValue({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    registrosSolicitados: [
      {
        indicador: "peso",
        frecuencia: "semanal",
        diaSemana: tocaHoy ? diaSemana : (diaSemana % 7) + 1,
      },
    ],
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await waitFor(() => expect(seguimiento.configuracion).toHaveBeenCalled())
  const peso = screen.queryByRole("button", { name: /^Peso:/ })
  expect(peso !== null).toBe(tocaHoy)
})

it("bloquea los suplementos durante el guardado y conserva ambos al registrarlos seguidos", async () => {
  const { nutricion, seguimiento } = apis(
    dieta([
      { nombre: "Vitamina D", dosis: null },
      { nombre: "Omega 3", dosis: null },
    ]),
  )
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const guardar = seguimiento.cambiarDia.getMockImplementation()!
  seguimiento.cambiarDia.mockImplementationOnce(async (...args) => {
    await pendiente
    return guardar(...args)
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).not.toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(seguimiento.cambiarDia).toHaveBeenCalledTimes(1)
  await act(async () => terminar())
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeChecked()
  expect(seguimiento.cambiarDia).toHaveBeenLastCalledWith(CLIENTE, hoyAgenda(), {
    suplementos: ["Vitamina D", "Omega 3"],
  })
})

it("un guardado fallido no marca el suplemento y permite reintentarlo", async () => {
  const { nutricion, seguimiento } = apis(dieta([{ nombre: "Vitamina D", dosis: null }]))
  seguimiento.cambiarDia.mockRejectedValueOnce(new Error("Sin conexión"))
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await fireEvent.press(await screen.findByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).not.toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
})

it("espera el registro del día antes de permitir cambiar suplementos", async () => {
  const { nutricion, seguimiento } = apis(
    dieta([
      { nombre: "Vitamina D", dosis: null },
      { nombre: "Omega 3", dosis: null },
    ]),
    {
      fecha: hoyAgenda(),
      pesoKg: null,
      pasos: null,
      suenoMin: null,
      creatina: null,
      suplementos: ["Vitamina D"],
    },
  )
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const leer = seguimiento.dias.getMockImplementation()!
  seguimiento.dias.mockImplementationOnce(async () => {
    await pendiente
    return leer()
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  expect(await screen.findByRole("checkbox", { name: "Omega 3 tomada" })).toBeDisabled()
  await act(async () => terminar())
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Omega 3 tomada" }))
  expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeChecked()
  expect(screen.getByRole("checkbox", { name: "Omega 3 tomada" })).toBeChecked()
})

it("protege el valor del diálogo hasta que el servidor confirma el guardado", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  let terminar!: () => void
  const pendiente = new Promise<void>((resolve) => {
    terminar = resolve
  })
  const guardar = seguimiento.cambiarDia.getMockImplementation()!
  seguimiento.cambiarDia.mockImplementationOnce(async (...args) => {
    await pendiente
    return guardar(...args)
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" }))
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "80")
  await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
  expect(screen.getByLabelText("Peso (kg)")).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText("Peso (kg)"), "81")
  expect(screen.getByDisplayValue("80")).toBeTruthy()
  await act(async () => terminar())
  expect(screen.getByRole("button", { name: "Peso: 80,0 kg. Cambiar" })).toBeTruthy()
})

it("limpia el error de carga al volver a enfocar y cargar la configuración", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  seguimiento.configuracion.mockRejectedValueOnce(new Error("Sin red"))
  const vista = await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  expect(
    await screen.findByText("No se pudo cargar el seguimiento pautado. Revisa la conexión."),
  ).toBeTruthy()
  await vista.rerender(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={{ ...seguimiento }}
      objetivoPasos={null}
    />,
  )
  await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" })
  expect(
    screen.queryByText("No se pudo cargar el seguimiento pautado. Revisa la conexión."),
  ).toBeNull()
})
