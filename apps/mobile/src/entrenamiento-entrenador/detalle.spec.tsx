import { StrictMode } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native"
import { AppState } from "react-native"
import {
  SeriePrescritaDistanciaSchema,
  ValoresEjecutadosDistanciaSchema,
} from "@alpha-omega/shared"
import type { ComentarioSesion, Molestia, ResultadoEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { ErrorDePermiso, ErrorDeSesion } from "../lib/http"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { DetalleEntrenador } from "./detalle"

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))
jest.mock("../entrenamiento/fecha-sesion", () => ({ FechaSesion: () => null }))
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock("../entrenamiento/resultado", () => {
  const real = jest.requireActual("../entrenamiento/resultado")
  return { ...real, PrescripcionVisible: jest.fn(real.PrescripcionVisible) }
})

beforeEach(() => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
})

function crearApi(parcial: object): ApiEntrenamiento {
  return {
    comentarios: jest.fn(async () => ({ comentarios: [] })),
    molestias: jest.fn(async () => ({ molestias: [], total: 0 })),
    ...parcial,
  } as unknown as ApiEntrenamiento
}

const sesion = {
  agenda: {
    id: "10000000-0000-4000-8000-000000000000",
    clienteId: "20000000-0000-4000-8000-000000000000",
    fechaOriginal: "2026-09-24",
    fechaActual: "2026-09-24",
    estado: "cerrada",
    revision: 1,
  },
  prescripcion: {
    nombre: "Fuerza",
    ejercicios: [
      {
        id: "30000000-0000-4000-8000-000000000010",
        ejercicioId: "30000000-0000-4000-8000-000000000011",
        nombre: "Plancha",
        indicaciones: null,
        series: [
          {
            id: "30000000-0000-4000-8000-000000000012",
            tipoMedicion: "tiempo" as const,
            pesoKg: null,
            segundos: 30,
          },
        ],
      },
    ],
  },
  revisionPrescripcion: 1,
  permiteAjuste: false,
  enviadoEn: "2026-09-24T10:00:00.000Z",
  revisadaEn: null as string | null,
}

const resultadoBase: ResultadoEntrenamiento = {
  sesionId: sesion.agenda.id,
  prescripcion: sesion.prescripcion,
  revisionPrescripcion: sesion.revisionPrescripcion,
  enviadoEn: sesion.enviadoEn,
  notas: null,
  series: [
    {
      serieId: "30000000-0000-4000-8000-000000000012",
      hecha: true,
      valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
    },
  ],
}

it.each([sesion.prescripcion.ejercicios[0]!.id, null, "fuera-de-prescripcion"])(
  "responde y actualiza la molestia desde revisión (ejercicio %s)",
  async (ejercicioPrescritoId) => {
    const molestia = {
      id: "molestia-a",
      sesionId: sesion.agenda.id,
      clienteId: sesion.agenda.clienteId,
      ejercicioPrescritoId,
      zona: "hombro",
      intensidad: 5,
      nivel: "ambar",
      sintomas: [],
      estado: "abierta",
      ejercicio: ejercicioPrescritoId ? "Plancha" : null,
      serie: null,
      nota: null,
    } as unknown as Molestia
    const atenderMolestia = jest.fn(async () => ({
      ...molestia,
      estado: "atendida" as const,
      respuesta: "Reduce la carga",
    }))
    const api = crearApi({
      leerEntrenador: async () => sesion,
      resultado: async () => resultadoBase,
      molestias: async () => ({ molestias: [molestia], total: 1 }),
      atenderMolestia,
    })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} nombreCliente="Lara" />)
    await fireEvent.press(await screen.findByRole("button", { name: /^Responder:/ }))
    await fireEvent.changeText(
      screen.getByLabelText("Respuesta para el cliente"),
      "Reduce la carga",
    )
    await fireEvent.press(screen.getByRole("button", { name: "Enviar respuesta" }))
    expect(atenderMolestia).toHaveBeenCalledWith("molestia-a", "Reduce la carga")
    expect(await screen.findByText("Tu respuesta: Reduce la carga")).toBeOnTheScreen()
    expect(screen.queryByText("Pendiente de ti")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Responder:/ })).toBeNull()
  },
)

it.each([new ErrorDePermiso(), new ErrorDeSesion()])(
  "retira la revisión si responder pierde el acceso (%s)",
  async (causa) => {
    const molestia = {
      id: "molestia-a",
      sesionId: sesion.agenda.id,
      ejercicioPrescritoId: null,
      zona: "hombro",
      intensidad: 5,
      nivel: "ambar",
      sintomas: [],
      estado: "abierta",
    } as unknown as Molestia
    const api = crearApi({
      leerEntrenador: async () => sesion,
      resultado: async () => resultadoBase,
      molestias: async () => ({ molestias: [molestia], total: 1 }),
      atenderMolestia: async () => {
        throw causa
      },
    })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await fireEvent.press(await screen.findByRole("button", { name: /^Responder:/ }))
    await fireEvent.changeText(
      screen.getByLabelText("Respuesta para el cliente"),
      "Reduce la carga",
    )
    await fireEvent.press(screen.getByRole("button", { name: "Enviar respuesta" }))
    expect(screen.queryByRole("button", { name: "Marcar como revisado" })).toBeNull()
    expect(screen.queryByText("Plancha")).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent(/No tienes permiso|Tu sesión ha caducado/)
  },
)

function comentario(texto: string, ejercicioPrescritoId: string | null = null): ComentarioSesion {
  return {
    id: `comentario-${texto}`,
    sesionId: sesion.agenda.id,
    ejercicioPrescritoId,
    ejercicio: ejercicioPrescritoId ? "Plancha" : null,
    texto,
    autor: { id: "entrenador", nombre: "Carlos", rol: "entrenador" },
    creadoEn: "2026-10-01T10:00:00.000Z",
  }
}

it("confirma revisión y comentario con efectos de StrictMode", async () => {
  const revisar = jest.fn(async () => ({ ...sesion, revisadaEn: sesion.enviadoEn }))
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    revisar,
    comentar: async (_id: string, datos: Parameters<ApiEntrenamiento["comentar"]>[1]) =>
      comentario(datos.texto),
  })
  await render(
    <StrictMode>
      <DetalleEntrenador
        id={sesion.agenda.id}
        api={api}
        nombreCliente="David"
        nuevoId={() => "operacion"}
      />
    </StrictMode>,
  )
  await fireEvent.changeText(
    screen.getByLabelText("Comentario para David"),
    "Comentario en StrictMode",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario general" }))
  expect(screen.getByText("Comentario en StrictMode")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
  expect(screen.getByRole("button", { name: "Revisada" })).toBeDisabled()
  expect(revisar).toHaveBeenCalledTimes(1)
})

it("muestra esqueleto y reintenta la lectura fallida sin confirmar una revisión", async () => {
  let rechazar!: (error: Error) => void
  const leerEntrenador = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rechazar = reject
        }),
    )
    .mockResolvedValue(sesion)
  const api = crearApi({ leerEntrenador, resultado: async () => resultadoBase })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThan(3)
  await act(async () => rechazar(new Error("sin red")))
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(screen.getByText("Fuerza")).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("comenta el ejercicio correcto y deja los comentarios generales al final", async () => {
  const ejercicioId = sesion.prescripcion.ejercicios[0]!.id
  const comentar = jest.fn(async (_: string, datos: Parameters<ApiEntrenamiento["comentar"]>[1]) =>
    comentario(datos.texto, datos.ejercicioPrescritoId),
  )
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => ({ ...resultadoBase, notas: "Me sentí fuerte" }),
    comentar,
    comentarios: async () => ({
      comentarios: [comentario("Mantén la espalda", ejercicioId), comentario("Buen trabajo")],
    }),
  })
  await render(
    <DetalleEntrenador
      id={sesion.agenda.id}
      api={api}
      nombreCliente="David"
      nuevoId={() => "operacion"}
    />,
  )
  expect(screen.getByText("«Me sentí fuerte»")).toBeOnTheScreen()
  expect(
    within(screen.getByTestId(`comentarios-${ejercicioId}`)).getByText("Mantén la espalda"),
  ).toBeOnTheScreen()
  expect(
    within(screen.getByTestId("comentarios-generales")).getByText("Buen trabajo"),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Comentar Plancha" }))
  await fireEvent.changeText(
    screen.getByLabelText("Comentario sobre Plancha"),
    "  Controla el tempo  ",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario sobre Plancha" }))
  expect(comentar).toHaveBeenLastCalledWith(sesion.agenda.id, {
    operacionId: "operacion",
    ejercicioPrescritoId: ejercicioId,
    texto: "Controla el tempo",
  })
  await fireEvent.changeText(screen.getByLabelText("Comentario para David"), "Buen entreno")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario general" }))
  expect(comentar).toHaveBeenLastCalledWith(sesion.agenda.id, {
    operacionId: "operacion",
    ejercicioPrescritoId: null,
    texto: "Buen entreno",
  })
})

it("conserva la operación de un comentario incierto para reintentarlo y distingue sus fechas", async () => {
  const comentar = jest
    .fn()
    .mockRejectedValueOnce(new Error("respuesta perdida"))
    .mockImplementation(async (_id, datos) => comentario(datos.texto))
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    comentar,
    comentarios: async () => ({
      comentarios: [
        comentario("Uno"),
        { ...comentario("Dos"), creadoEn: "2026-10-22T10:00:00.000Z" },
      ],
    }),
  })
  const nuevoId = jest.fn(() => "operacion-unica")
  await render(
    <DetalleEntrenador id={sesion.agenda.id} api={api} nombreCliente="David" nuevoId={nuevoId} />,
  )
  expect(screen.getByText(/Carlos.*1 oct/)).toBeOnTheScreen()
  expect(screen.getByText(/Carlos.*22 oct/)).toBeOnTheScreen()
  await fireEvent.changeText(screen.getByLabelText("Comentario para David"), "Comentario original")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar comentario general" }))
  expect(screen.getByLabelText("Comentario para David").props.editable).toBe(false)
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar comentario general" }))
  expect(comentar.mock.calls[1]).toEqual(comentar.mock.calls[0])
  expect(nuevoId).toHaveBeenCalledTimes(1)
  expect(screen.getByText("Comentario original")).toBeOnTheScreen()
})

it("reintenta una revisión fallida, evita dos peticiones y deshabilita la acción confirmada", async () => {
  let resolver!: (valor: typeof sesion) => void
  const revisar = jest
    .fn()
    .mockRejectedValueOnce(new Error("sin red"))
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    revisar,
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  const boton = screen.getByRole("button", { name: "Marcar como revisado" })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(revisar).toHaveBeenCalledTimes(2)
  await act(async () => resolver({ ...sesion, revisadaEn: sesion.enviadoEn } as typeof sesion))
  expect(screen.getByRole("button", { name: "Revisada" })).toBeDisabled()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("una revisión tardía de otra ruta no confirma la sesión visible", async () => {
  let resolver!: (valor: typeof sesion) => void
  const revisar = jest.fn(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  const otra = {
    ...sesion,
    agenda: { ...sesion.agenda, id: "otra" },
    prescripcion: { ...sesion.prescripcion, nombre: "Otra sesión" },
  }
  const api = crearApi({
    leerEntrenador: async (id: string) => (id === "otra" ? otra : sesion),
    resultado: async () => resultadoBase,
    revisar,
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
  await screen.rerender(<DetalleEntrenador id="otra" api={api} />)
  await act(async () => resolver({ ...sesion, revisadaEn: sesion.enviadoEn } as typeof sesion))
  expect(screen.getByText("Otra sesión")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Marcar como revisado" })).toBeEnabled()
})

it("sitúa las molestias de este ejercicio y esta sesión junto a su próxima vez", async () => {
  const ejercicioId = sesion.prescripcion.ejercicios[0]!.id
  const molestia = {
    id: "m1",
    sesionId: sesion.agenda.id,
    clienteId: sesion.agenda.clienteId,
    ejercicioPrescritoId: ejercicioId,
    ejercicio: "Plancha",
    serie: 1,
    zona: "hombro",
    intensidad: 4,
    sintomas: [],
    nivel: "ambar",
    nota: null,
    creadaEn: sesion.enviadoEn,
    estado: "abierta",
    respuesta: null,
    atendidaEn: null,
  }
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    molestias: async () => ({
      molestias: [molestia, { ...molestia, id: "m2", sesionId: "otra", zona: "lumbar" }],
      total: 2,
    }),
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  expect(screen.getByText("Próxima vez · En revisión")).toBeOnTheScreen()
  expect(screen.getByText("Molestia · hombro, serie 1")).toBeOnTheScreen()
  expect(screen.getByText("Pendiente de ti")).toBeOnTheScreen()
  expect(screen.queryByText(/lumbar/)).toBeNull()
})

it("espera a conocer las molestias antes de recomendar la próxima carga", async () => {
  let rechazar!: (error: Error) => void
  const molestias = jest
    .fn()
    .mockImplementationOnce(() => new Promise((_, reject) => (rechazar = reject)))
    .mockResolvedValue({ molestias: [], total: 0 })
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    molestias,
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  expect(screen.getByRole("text", { name: /Serie 1.*30 s/ })).toBeOnTheScreen()
  expect(screen.queryByText(/^Próxima vez/)).toBeNull()

  await act(async () => rechazar(new Error("sin red")))
  expect(screen.queryByText(/^Próxima vez/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar comentarios y molestias" }))

  expect(screen.getByText("Próxima vez · Sube la carga")).toBeOnTheScreen()
})

it("reintenta la lectura auxiliar sin ocultar las series ni duplicar comentarios", async () => {
  const comentarios = jest
    .fn()
    .mockRejectedValueOnce(new Error("sin red"))
    .mockResolvedValueOnce({ comentarios: [comentario("Carga recuperada")] })
  const api = crearApi({
    leerEntrenador: async () => sesion,
    resultado: async () => resultadoBase,
    comentarios,
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  expect(screen.getByRole("text", { name: /Serie 1.*30 s/ })).toBeOnTheScreen()
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar comentarios y molestias" }))
  expect(screen.getByText("Carga recuperada")).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})

it("una petición lenta de comentario bloquea edición y doble envío y no aparece en otra sesión", async () => {
  let resolver!: (valor: ComentarioSesion) => void
  const comentar = jest.fn(
    () =>
      new Promise<ComentarioSesion>((resolve) => {
        resolver = resolve
      }),
  )
  const api = crearApi({
    leerEntrenador: async (id: string) => ({ ...sesion, agenda: { ...sesion.agenda, id } }),
    resultado: async (id: string) => ({ ...resultadoBase, sesionId: id }),
    comentar,
  })
  await render(
    <DetalleEntrenador
      id={sesion.agenda.id}
      api={api}
      nombreCliente="David"
      nuevoId={() => "operacion"}
    />,
  )
  await fireEvent.changeText(screen.getByLabelText("Comentario para David"), "Comentario A")
  const boton = screen.getByRole("button", { name: "Enviar comentario general" })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(comentar).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText("Comentario para David").props.editable).toBe(false)
  await screen.rerender(<DetalleEntrenador id="otra" api={api} nombreCliente="David" />)
  await act(async () => resolver(comentario("Comentario A")))
  expect(screen.queryByText("Comentario A")).toBeNull()
  expect(screen.getByLabelText("Comentario para David").props.value).toBe("")
})

it("el sondeo conserva el borrador de un ejercicio abierto", async () => {
  jest.useFakeTimers()
  try {
    const api = crearApi({
      leerEntrenador: async () => ({ ...sesion }),
      resultado: async () => ({ ...resultadoBase }),
    })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await fireEvent.press(screen.getByRole("button", { name: "Comentar Plancha" }))
    await fireEvent.changeText(
      screen.getByLabelText("Comentario sobre Plancha"),
      "Borrador del ejercicio",
    )
    await act(async () => jest.advanceTimersByTime(5000))
    expect(screen.getByLabelText("Comentario sobre Plancha").props.value).toBe(
      "Borrador del ejercicio",
    )
  } finally {
    jest.useRealTimers()
  }
})

it("solo marca revisada la sesión cuando el entrenador lo solicita", async () => {
  Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
  const leerEntrenador = jest.fn(async () => sesion)
  const revisar = jest.fn(async () => ({ ...sesion, revisadaEn: "2026-09-24T11:00:00.000Z" }))
  const api = crearApi({
    leerEntrenador,
    revisar,
    resultado: jest.fn(async () => resultadoBase),
  })
  await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
  await waitFor(() => expect(screen.getByText("Fuerza")).toBeTruthy())
  expect(revisar).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
  await waitFor(() => expect(revisar).toHaveBeenCalledWith(sesion.agenda.id))
  expect(screen.getAllByText("Revisada")[0]).toBeTruthy()
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
  const api = crearApi({
    leerEntrenador: jest.fn(async () => ({ ...sesion, prescripcion })),
    resultado: jest.fn(async () => resultado),
    revisar: jest.fn(),
  })
  try {
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await waitFor(() => expect(screen.getByText("34 kg × 18 m")).toBeTruthy())
    expect(screen.getByRole("text", { name: /Serie 1.*Objetivo: 32 kg × 20 m/ })).toBeTruthy()
    expect(screen.getByRole("text", { name: /Serie 2.*Objetivo: 32 kg × 20 m/ })).toBeTruthy()
    expect(screen.getByText("Omitida")).toBeTruthy()
    expect(screen.getByText(/1 de 2 series/)).toBeTruthy()
    expect(screen.queryByText(/rep/)).toBeNull()
  } finally {
    resumen.mockImplementation(vacio)
  }
})

describe("sondeo del detalle (T-18)", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Object.defineProperty(AppState, "currentState", { configurable: true, value: "active" })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it.each([
    ["sesion", new ErrorDePermiso("403")],
    ["resultado", new ErrorDeSesion("401")],
  ])("retira los datos y acciones al perder acceso en %s", async (origen, error) => {
    const leerEntrenador = jest.fn().mockResolvedValue(sesion)
    const resultado = jest.fn().mockResolvedValue(resultadoBase)
    const api = crearApi({ leerEntrenador, resultado })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    expect(screen.getByText("Fuerza")).toBeOnTheScreen()
    if (origen === "sesion") leerEntrenador.mockRejectedValue(error)
    else resultado.mockRejectedValue(error)

    await act(async () => jest.advanceTimersByTime(5000))

    expect(screen.queryByText("Fuerza")).toBeNull()
    expect(screen.queryByLabelText("Comentario para Cliente")).toBeNull()
    expect(screen.queryByRole("button", { name: "Marcar como revisado" })).toBeNull()
    expect(screen.getByRole("alert")).toBeOnTheScreen()
  })

  it("una revisión pendiente no restaura datos después de revocarse el permiso", async () => {
    let confirmar!: (valor: typeof sesion) => void
    const leerEntrenador = jest
      .fn()
      .mockResolvedValueOnce(sesion)
      .mockRejectedValue(new ErrorDePermiso("403"))
    const api = crearApi({
      leerEntrenador,
      resultado: async () => resultadoBase,
      revisar: () => new Promise<typeof sesion>((resolve) => (confirmar = resolve)),
    })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
    await act(async () => jest.advanceTimersByTime(5000))
    await act(async () => confirmar({ ...sesion, revisadaEn: sesion.enviadoEn }))

    expect(screen.queryByText("Fuerza")).toBeNull()
    expect(screen.queryByRole("button", { name: "Revisada" })).toBeNull()
  })

  it("deja de sondear y de recargar al activar la app si ya está enviada y revisada", async () => {
    const actividad = jest.spyOn(AppState, "addEventListener")
    const leerEntrenador = jest.fn(async () => ({ ...sesion, revisadaEn: sesion.enviadoEn }))
    const resultado = jest.fn(async () => resultadoBase)
    const api = crearApi({ leerEntrenador, resultado })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await waitFor(() => expect(screen.getAllByText("Revisada")[0]).toBeTruthy())

    await act(async () => {
      jest.advanceTimersByTime(15_000)
      actividad.mock.calls[0]![1]("active")
    })

    expect(leerEntrenador).toHaveBeenCalledTimes(1)
    expect(resultado).toHaveBeenCalledTimes(1)
  })

  it("deja de sondear cuando el entrenador marca la revisión desde el detalle", async () => {
    const leerEntrenador = jest.fn(async () => sesion)
    const resultado = jest.fn(async () => resultadoBase)
    const revisar = jest.fn(async () => ({ ...sesion, revisadaEn: sesion.enviadoEn }))
    const api = crearApi({ leerEntrenador, resultado, revisar })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    await fireEvent.press(screen.getByRole("button", { name: "Marcar como revisado" }))
    await waitFor(() => expect(screen.getAllByText("Revisada")[0]).toBeTruthy())

    await act(async () => jest.advanceTimersByTime(15_000))

    expect(leerEntrenador).toHaveBeenCalledTimes(1)
    expect(resultado).toHaveBeenCalledTimes(1)
  })

  it("solo consulta la sesión mientras está pendiente y carga el resultado al enviarse", async () => {
    const leerEntrenador = jest
      .fn()
      .mockResolvedValueOnce({ ...sesion, enviadoEn: null })
      .mockResolvedValue(sesion)
    const resultado = jest.fn(async () => resultadoBase)
    const api = crearApi({ leerEntrenador, resultado })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    expect(screen.getByText("Aún no ha terminado el entrenamiento")).toBeTruthy()
    expect(resultado).not.toHaveBeenCalled()

    await act(async () => jest.advanceTimersByTime(5_000))

    expect(leerEntrenador).toHaveBeenCalledTimes(2)
    expect(resultado).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Marcar como revisado" })).toBeTruthy()
  })

  it("muestra la sesión recién leída aunque falle su resultado", async () => {
    const api = crearApi({
      leerEntrenador: jest.fn(async () => sesion),
      resultado: jest.fn(async () => {
        throw new Error("Sin conexión")
      }),
    })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)

    expect(screen.getByText("Fuerza")).toBeTruthy()
    expect(screen.getByText("No se pudo actualizar el entrenamiento.")).toBeTruthy()
  })

  it("consulta en paralelo una sesión enviada y conserva el resultado si falla la sesión", async () => {
    let rechazar!: (error: Error) => void
    const leerEntrenador = jest
      .fn()
      .mockResolvedValueOnce(sesion)
      .mockImplementationOnce(() => new Promise((_, reject) => (rechazar = reject)))
    const actualizado = { ...resultadoBase, notas: "Resultado actualizado" }
    const resultado = jest.fn().mockResolvedValueOnce(resultadoBase).mockResolvedValue(actualizado)
    const api = crearApi({ leerEntrenador, resultado })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)

    await act(async () => jest.advanceTimersByTime(5_000))
    expect(resultado).toHaveBeenCalledTimes(2)
    await act(async () => rechazar(new Error("Sin conexión")))

    expect(screen.getByText("Fuerza")).toBeTruthy()
    expect(jest.mocked(PrescripcionVisible).mock.calls.at(-1)![0].resultado).toBe(actualizado)
    expect(screen.getByText("No se pudo actualizar el entrenamiento.")).toBeTruthy()
  })

  it("recupera un resultado fallido antes de parar el sondeo de una sesión revisada", async () => {
    const leerEntrenador = jest.fn(async () => ({ ...sesion, revisadaEn: sesion.enviadoEn }))
    const resultado = jest
      .fn()
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValue(resultadoBase)
    const api = crearApi({ leerEntrenador, resultado })
    await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)
    expect(screen.getByText("No se pudo actualizar el entrenamiento.")).toBeTruthy()

    await act(async () => jest.advanceTimersByTime(5_000))
    expect(screen.getAllByText("Revisada")[0]).toBeTruthy()
    expect(screen.queryByText("No se pudo actualizar el entrenamiento.")).toBeNull()
    await act(async () => jest.advanceTimersByTime(15_000))

    expect(leerEntrenador).toHaveBeenCalledTimes(2)
    expect(resultado).toHaveBeenCalledTimes(2)
  })

  it("no solicita el resultado si la lectura termina después de salir de la pantalla", async () => {
    let resolver!: (valor: typeof sesion) => void
    const leerEntrenador = jest.fn(
      () => new Promise<typeof sesion>((resolve) => (resolver = resolve)),
    )
    const resultado = jest.fn(async () => resultadoBase)
    const api = crearApi({ leerEntrenador, resultado })
    const vista = await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)

    await vista.unmount()
    await act(async () => resolver(sesion))

    expect(leerEntrenador).toHaveBeenCalledTimes(1)
    expect(resultado).not.toHaveBeenCalled()
  })

  it("quita el intervalo y la escucha de actividad al salir de la pantalla", async () => {
    const remove = jest.fn()
    jest.spyOn(AppState, "addEventListener").mockReturnValue({ remove })
    const leerEntrenador = jest.fn(async () => sesion)
    const api = crearApi({
      leerEntrenador,
      resultado: jest.fn(async () => resultadoBase),
    })
    const vista = await render(<DetalleEntrenador id={sesion.agenda.id} api={api} />)

    await vista.unmount()
    await act(async () => jest.advanceTimersByTime(15_000))

    expect(remove).toHaveBeenCalledTimes(1)
    expect(leerEntrenador).toHaveBeenCalledTimes(1)
  })
})
