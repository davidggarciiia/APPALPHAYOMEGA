import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type CambiarDia,
  type DiaDeSeguimiento,
  type DocumentoDieta,
  type Medida,
  type RegistrarMedida,
} from "@alpha-omega/shared"

import { hoyAgenda } from "../entrenamiento/fechas"
import { ErrorDePermiso, ErrorDeRed, ErrorDeSesion, ErrorDelServidor } from "../lib/http"
import type { ApiSeguimiento } from "../seguimiento/api"
import type { ApiNutricion } from "./api"
import { leerCopia } from "./copia-local"
import { HoyInicio } from "./hoy-inicio"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
jest.mock("../entrenamiento/almacen-dispositivo", () => ({ almacenDispositivo: {} }))
jest.mock("./copia-local", () => ({ leerCopia: jest.fn(async () => null) }))
jest.mock("expo-crypto", () => ({
  randomUUID: () => jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID(),
}))

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const TIPO = "00000000-0000-4000-8000-000000000001"

beforeEach(() => jest.mocked(leerCopia).mockReset().mockResolvedValue(null))

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
    medidas: jest.fn(async () => ({ medidas: [] as Medida[], fechaNacimiento: null })),
    registrarMedida: jest.fn(
      async (
        _clienteId: string,
        { operacionId: _, ...datos }: RegistrarMedida,
      ): Promise<Medida> => ({
        id: "40000000-0000-4000-8000-000000000000",
        ...datos,
        creadoEn: "2026-09-24T08:00:00.000Z",
      }),
    ),
  } satisfies Pick<
    ApiSeguimiento,
    "configuracion" | "dias" | "cambiarDia" | "medidas" | "registrarMedida"
  >
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
  expect(screen.queryByText("Hoy")).toBeNull()
})

it("espera la configuración y el día con un esqueleto, sin mostrar una tarjeta vacía", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  let terminar!: () => void
  const pendiente = new Promise<void>((resolver) => {
    terminar = resolver
  })
  seguimiento.configuracion.mockImplementationOnce(async () => {
    await pendiente
    return CONFIGURACION_SEGUIMIENTO_INICIAL
  })
  await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={7000}
    />,
  )
  expect(screen.getByLabelText("Cargando registros de hoy")).toHaveProp("accessibilityState", {
    busy: true,
  })
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThan(0)
  expect(screen.queryByRole("button", { name: /^Peso:/ })).toBeNull()
  await act(async () => terminar())
  expect(await screen.findByRole("button", { name: /^Peso:/ })).toBeEnabled()
  expect(screen.queryByLabelText("Cargando registros de hoy")).toBeNull()
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
  expect(screen.getByLabelText("Cargando registros de hoy")).toBeTruthy()
  expect(screen.queryByRole("checkbox", { name: "Omega 3 tomada" })).toBeNull()
  expect(seguimiento.cambiarDia).not.toHaveBeenCalled()
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

describe("cintura desde Inicio", () => {
  const diaSemana = new Date(`${hoyAgenda()}T00:00:00Z`).getUTCDay() || 7
  function conCintura(
    seguimiento: ReturnType<typeof apis>["seguimiento"],
    frecuencia: "diaria" | "semanal" = "diaria",
    dia: number | null = null,
    indicadores = CONFIGURACION_SEGUIMIENTO_INICIAL.indicadores,
  ) {
    seguimiento.configuracion.mockResolvedValue({
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores,
      registrosSolicitados: [{ indicador: "cintura", frecuencia, diaSemana: dia }],
    })
  }
  const pintar = async (apisDePrueba: ReturnType<typeof apis>) =>
    render(
      <HoyInicio
        clienteId={CLIENTE}
        nutricion={apisDePrueba.nutricion}
        seguimiento={apisDePrueba.seguimiento}
        objetivoPasos={null}
      />,
    )

  it("se apunta en cm con coma decimal cuando está pautada a diario", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento)
    await pintar(apisDePrueba)
    await fireEvent.press(
      await screen.findByRole("button", { name: "Cintura: sin apuntar. Cambiar" }),
    )
    await fireEvent.changeText(screen.getByLabelText("Cintura (cm)"), "92,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() =>
      expect(apisDePrueba.seguimiento.registrarMedida).toHaveBeenCalledWith(CLIENTE, {
        operacionId: expect.any(String),
        fecha: hoyAgenda(),
        pesoKg: null,
        cinturaCm: 92.5,
        grasaPct: null,
        alturaCm: null,
      }),
    )
    expect(await screen.findByRole("button", { name: "Cintura: 92,5 cm. Cambiar" })).toBeTruthy()
    expect(apisDePrueba.seguimiento.cambiarDia).not.toHaveBeenCalled()
  })

  it("muestra la cintura ya apuntada hoy", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento)
    apisDePrueba.seguimiento.medidas.mockResolvedValue({
      medidas: [
        {
          id: "40000000-0000-4000-8000-000000000001",
          fecha: hoyAgenda(),
          pesoKg: 80,
          cinturaCm: 90,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-09-24T07:00:00.000Z",
        },
      ],
      fechaNacimiento: null,
    })
    await pintar(apisDePrueba)
    expect(await screen.findByRole("button", { name: "Cintura: 90 cm. Cambiar" })).toBeTruthy()
  })

  it.each([true, false])(
    "respeta el día semanal de la cintura (corresponde hoy: %s)",
    async (hoy) => {
      const apisDePrueba = apis(dieta())
      conCintura(apisDePrueba.seguimiento, "semanal", hoy ? diaSemana : (diaSemana % 7) + 1)
      await pintar(apisDePrueba)
      await waitFor(() => expect(apisDePrueba.seguimiento.configuracion).toHaveBeenCalled())
      if (hoy) expect(await screen.findByRole("button", { name: /^Cintura:/ })).toBeTruthy()
      else expect(screen.queryByRole("button", { name: /^Cintura:/ })).toBeNull()
    },
  )

  it("no la pide si el entrenador ocultó el indicador", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento, "diaria", null, ["peso", "pasos"])
    await pintar(apisDePrueba)
    await waitFor(() => expect(apisDePrueba.seguimiento.configuracion).toHaveBeenCalled())
    expect(screen.queryByRole("button", { name: /^Cintura:/ })).toBeNull()
  })

  it("un valor fuera de rango no se envía y conserva lo escrito", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento)
    await pintar(apisDePrueba)
    await fireEvent.press(await screen.findByRole("button", { name: /^Cintura:/ }))
    await fireEvent.changeText(screen.getByLabelText("Cintura (cm)"), "12")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByText("Escribe una cintura entre 30 y 300 cm.")).toBeTruthy()
    expect(screen.getByDisplayValue("12")).toBeTruthy()
    expect(apisDePrueba.seguimiento.registrarMedida).not.toHaveBeenCalled()
  })

  it("un fallo de red mantiene la edición y el reintento usa la misma operación", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento)
    apisDePrueba.seguimiento.registrarMedida.mockRejectedValueOnce(new Error("Sin red"))
    await pintar(apisDePrueba)
    await fireEvent.press(await screen.findByRole("button", { name: /^Cintura:/ }))
    await fireEvent.changeText(screen.getByLabelText("Cintura (cm)"), "92,5")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findByText(/No se pudo guardar/)).toBeTruthy()
    expect(screen.getByDisplayValue("92,5")).toBeTruthy()
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findByRole("button", { name: "Cintura: 92,5 cm. Cambiar" })).toBeTruthy()
    const [primera, segunda] = apisDePrueba.seguimiento.registrarMedida.mock.calls
    expect(segunda![1].operacionId).toBe(primera![1].operacionId)
  })

  it("pulsar Guardar varias veces durante una respuesta lenta registra una sola medida", async () => {
    const apisDePrueba = apis(dieta())
    conCintura(apisDePrueba.seguimiento)
    let terminar!: () => void
    const pendiente = new Promise<void>((resolve) => {
      terminar = resolve
    })
    const registrar = apisDePrueba.seguimiento.registrarMedida.getMockImplementation()!
    apisDePrueba.seguimiento.registrarMedida.mockImplementationOnce(async (...args) => {
      await pendiente
      return registrar(...args)
    })
    await pintar(apisDePrueba)
    await fireEvent.press(await screen.findByRole("button", { name: /^Cintura:/ }))
    await fireEvent.changeText(screen.getByLabelText("Cintura (cm)"), "91")
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    await fireEvent.press(screen.getByRole("button", { name: "Guardar" }))
    expect(screen.getByLabelText("Cintura (cm)")).toBeDisabled()
    await act(async () => terminar())
    expect(await screen.findByRole("button", { name: "Cintura: 91 cm. Cambiar" })).toBeTruthy()
    expect(apisDePrueba.seguimiento.registrarMedida).toHaveBeenCalledTimes(1)
  })
})

it("al volver a enfocar recarga sin vaciar la tarjeta de Hoy (N-03)", async () => {
  const { nutricion, seguimiento } = apis(dieta())
  const vista = await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={7000}
    />,
  )
  expect(await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" })).toBeTruthy()

  // La recarga tarda: mientras llega, lo ya mostrado no debe desaparecer ni parpadear.
  seguimiento.configuracion.mockImplementationOnce(() => new Promise(() => undefined))
  await vista.rerender(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={{ ...seguimiento }}
      objetivoPasos={7000}
    />,
  )
  expect(screen.getByRole("button", { name: "Peso: sin apuntar. Cambiar" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Pasos: sin apuntar. Cambiar" })).toBeTruthy()
})

it.each([new ErrorDeRed(), new ErrorDelServidor(503), new Error("Respuesta inválida")])(
  "conserva los suplementos de la copia en solo lectura ante %s (N-04)",
  async (fallo) => {
    const { nutricion, seguimiento } = apis(dieta([{ nombre: "Vitamina D", dosis: "1 cápsula" }]))
    const vigente = await nutricion.vigente()
    jest.mocked(leerCopia).mockResolvedValue({ ...vigente, actualizadaEn: "2026-10-28T08:00:00Z" })
    nutricion.vigente.mockRejectedValue(fallo)

    await render(
      <HoyInicio
        clienteId={CLIENTE}
        nutricion={nutricion}
        seguimiento={seguimiento}
        objetivoPasos={null}
      />,
    )
    const suplemento = await screen.findByRole("checkbox", { name: "Vitamina D tomada" })
    expect(suplemento).toBeDisabled()
    expect(screen.getByText("1 cápsula")).toBeTruthy()
    expect(screen.getByText("Suplementos de la copia guardada · solo lectura.")).toBeTruthy()
    await fireEvent.press(suplemento)
    expect(seguimiento.cambiarDia).not.toHaveBeenCalled()
    expect(leerCopia).toHaveBeenCalledWith(expect.anything(), CLIENTE)
  },
)

it.each([new ErrorDeSesion(), new ErrorDePermiso()])(
  "no consulta la copia cuando falla la autorización con %s (N-04)",
  async (fallo) => {
    const { nutricion, seguimiento } = apis(null)
    nutricion.vigente.mockRejectedValue(fallo)
    await render(
      <HoyInicio
        clienteId={CLIENTE}
        nutricion={nutricion}
        seguimiento={seguimiento}
        objetivoPasos={null}
      />,
    )
    await screen.findByRole("button", { name: "Peso: sin apuntar. Cambiar" })
    expect(leerCopia).not.toHaveBeenCalled()
    expect(screen.queryByRole("checkbox")).toBeNull()
  },
)

it("recupera la edición de suplementos al volver a cargar desde el servidor (N-04)", async () => {
  const { nutricion, seguimiento } = apis(dieta([{ nombre: "Vitamina D", dosis: null }]))
  const vigente = await nutricion.vigente()
  jest.mocked(leerCopia).mockResolvedValue({ ...vigente, actualizadaEn: "2026-10-28T08:00:00Z" })
  nutricion.vigente.mockRejectedValueOnce(new ErrorDeRed())
  const vista = await render(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={nutricion}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  expect(await screen.findByRole("checkbox", { name: "Vitamina D tomada" })).toBeDisabled()
  await vista.rerender(
    <HoyInicio
      clienteId={CLIENTE}
      nutricion={{ ...nutricion }}
      seguimiento={seguimiento}
      objetivoPasos={null}
    />,
  )
  await waitFor(() =>
    expect(screen.getByRole("checkbox", { name: "Vitamina D tomada" })).toBeEnabled(),
  )
  expect(screen.queryByText("Suplementos de la copia guardada · solo lectura.")).toBeNull()
  await fireEvent.press(screen.getByRole("checkbox", { name: "Vitamina D tomada" }))
  expect(seguimiento.cambiarDia).toHaveBeenCalledTimes(1)
})
