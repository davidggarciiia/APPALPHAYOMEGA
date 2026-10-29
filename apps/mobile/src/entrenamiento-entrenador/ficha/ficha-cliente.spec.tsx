import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AppState, StyleSheet } from "react-native"
import type { FichaDeUsuario, ListadoResultados, Molestia } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../../entrenamiento/api"
import type { ApiNutricion } from "../../nutricion/api"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import type { ApiSeguimiento } from "../../seguimiento/api"
import type { ApiMedios } from "../../seguimiento/medios-api"
import type { ApiValoraciones } from "../../seguimiento/valoraciones-api"
import { FichaCliente } from "./ficha-cliente"

const mockEntradaValoracion = jest.fn()
jest.mock("../../seguimiento/editor-valoracion", () => ({
  ValoracionesProfesional: function EditorDePrueba({
    alEditar,
    iniciarInicial,
    fechaNacimiento,
  }: {
    alEditar?: (valor: boolean) => void
    iniciarInicial?: boolean
    fechaNacimiento?: string | null
  }) {
    mockEntradaValoracion({ iniciarInicial, fechaNacimiento })
    const { useEffect, useState } = jest.requireActual<typeof import("react")>("react")
    const { TextInput } = jest.requireActual<typeof import("react-native")>("react-native")
    const [valor, cambiar] = useState("")
    useEffect(() => {
      alEditar?.(true)
      return () => alEditar?.(false)
    }, [alEditar])
    return (
      <TextInput accessibilityLabel="Valoración en edición" value={valor} onChangeText={cambiar} />
    )
  },
}))
jest.mock("../../seguimiento/progreso", () => ({ ProgresoCliente: () => null }))

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => false)
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    canGoBack: mockCanGoBack,
  }),
}))

const clienteId = "30000000-0000-4000-8000-000000000000"
const sesionId = "20000000-0000-4000-8000-000000000000"

beforeEach(() => {
  AppState.currentState = "active"
})

function apiDeFicha() {
  return {
    plan: jest.fn(async () => ({ plan: null })),
    resultados: jest
      .fn<ReturnType<ApiEntrenamiento["resultados"]>, Parameters<ApiEntrenamiento["resultados"]>>()
      .mockResolvedValue({ resultados: [] }),
    molestias: jest
      .fn<ReturnType<ApiEntrenamiento["molestias"]>, Parameters<ApiEntrenamiento["molestias"]>>()
      .mockResolvedValue({ molestias: [], total: 0 }),
    novedades: jest.fn(async () => ({ novedades: [], total: 0, sinLeer: 0 })),
  }
}

async function mostrarFicha(
  api: ApiEntrenamiento,
  consultas: Partial<
    Pick<
      Parameters<typeof FichaCliente>[0],
      | "leerFicha"
      | "nutricion"
      | "seguimiento"
      | "verSemana"
      | "valoraciones"
      | "valoracionInicial"
      | "pestanaInicial"
    >
  > = {},
): Promise<void> {
  await render(
    <FichaCliente
      clienteId={clienteId}
      cuentaId={clienteId}
      leerFicha={async () =>
        ({ nombre: "Lara", apellidos: "García", estado: "activo" }) as FichaDeUsuario
      }
      api={api}
      seguimiento={
        {
          medidas: async () => ({ medidas: [], fechaNacimiento: null }),
          consentimiento: async () => null,
        } as unknown as ApiSeguimiento
      }
      nutricion={{ vigente: async () => null } as unknown as ApiNutricion}
      valoraciones={
        { listar: async () => ({ total: 0, valoraciones: [] }) } as unknown as ApiValoraciones
      }
      medios={{} as ApiMedios}
      nuevoId={() => clienteId}
      editarPlan={jest.fn()}
      verSemana={jest.fn()}
      abrirNutricion={jest.fn()}
      {...consultas}
    />,
  )
}

it("ofrece valoración inicial en Resumen solo cuando no hay ninguna visita", async () => {
  const listar = jest.fn(async () => ({ total: 0, valoraciones: [] }))
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento, {
    valoraciones: { listar } as unknown as ApiValoraciones,
    leerFicha: async () => ({ nombre: "Lara", fechaNacimiento: "1990-05-12" }) as FichaDeUsuario,
  })
  expect(listar).toHaveBeenCalledWith(clienteId, 1)
  await fireEvent.press(await screen.findByRole("button", { name: "Valoración inicial" }))
  expect(screen.getByRole("tab", { name: "Progreso" })).toBeSelected()
  expect(screen.getByLabelText("Valoración en edición")).toBeOnTheScreen()
  expect(mockEntradaValoracion).toHaveBeenLastCalledWith({
    iniciarInicial: true,
    fechaNacimiento: "1990-05-12",
  })
})

it.each(["borrador", "publicada", "sin datos de visitas"])(
  "no ofrece una inicial en Resumen con %s",
  async (estado) => {
    const listar = jest.fn(async () => {
      if (estado === "sin datos de visitas") throw new Error("Sin conexión")
      return { total: 1, valoraciones: [] }
    })
    await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento, {
      valoraciones: { listar } as unknown as ApiValoraciones,
    })
    await screen.findByText("Lara García")
    expect(screen.queryByRole("button", { name: "Valoración inicial" })).toBeNull()
  },
)

it("el acceso tras el alta entra en Progreso y solicita la selección inicial", async () => {
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento, { valoracionInicial: true })
  expect(await screen.findByLabelText("Valoración en edición")).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Progreso" })).toBeSelected()
  expect(mockEntradaValoracion).toHaveBeenLastCalledWith({
    iniciarInicial: true,
    fechaNacimiento: undefined,
  })
})

it("el acceso desde Notificaciones abre Progreso sin solicitar una valoración inicial", async () => {
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento, { pestanaInicial: "progreso" })
  expect(await screen.findByLabelText("Valoración en edición")).toBeOnTheScreen()
  expect(screen.getByRole("tab", { name: "Progreso" })).toBeSelected()
  expect(mockEntradaValoracion).toHaveBeenLastCalledWith({
    iniciarInicial: false,
    fechaNacimiento: undefined,
  })
})

it.each(["cliente", "cuenta"])(
  "aísla la ficha y sus borradores al cambiar de %s",
  async (cambio) => {
    const api = apiDeFicha()
    const propiedades = {
      clienteId,
      cuentaId: "entrenador-A",
      api: api as unknown as ApiEntrenamiento,
      seguimiento: {
        medidas: async () => ({ medidas: [], fechaNacimiento: null }),
        consentimiento: async () => null,
      } as unknown as ApiSeguimiento,
      nutricion: { vigente: async () => null } as unknown as ApiNutricion,
      valoraciones: {
        listar: async () => ({ total: 0, valoraciones: [] }),
      } as unknown as ApiValoraciones,
      medios: {} as ApiMedios,
      nuevoId: () => clienteId,
      editarPlan: jest.fn(),
      verSemana: jest.fn(),
      abrirNutricion: jest.fn(),
    }
    await render(
      <FichaCliente
        {...propiedades}
        leerFicha={async () => ({ nombre: "Lara" }) as FichaDeUsuario}
      />,
    )
    await fireEvent.press(screen.getByRole("tab", { name: "Progreso" }))
    await fireEvent.changeText(screen.getByLabelText("Valoración en edición"), "Dato de Lara")
    let resolver!: (ficha: FichaDeUsuario) => void
    await screen.rerender(
      <FichaCliente
        {...propiedades}
        {...(cambio === "cliente" ? { clienteId: "cliente-B" } : { cuentaId: "entrenador-B" })}
        leerFicha={() => new Promise((resolve) => (resolver = resolve))}
      />,
    )

    expect(screen.queryByText("Lara")).toBeNull()
    expect(screen.queryByDisplayValue("Dato de Lara")).toBeNull()
    expect(screen.getByLabelText("Cargando ficha")).toBeOnTheScreen()
    await act(async () => resolver({ nombre: "Bea" } as FichaDeUsuario))
    expect(screen.getByText("Bea")).toBeOnTheScreen()
    expect(screen.getByRole("tab", { name: "Resumen" }).props.accessibilityState.selected).toBe(
      true,
    )
  },
)

describe("actualización de la ficha abierta", () => {
  const estadoAnterior = AppState.currentState
  beforeEach(() => {
    jest.useFakeTimers()
    AppState.currentState = "active"
  })
  afterEach(() => {
    AppState.currentState = estadoAnterior
    jest.useRealTimers()
  })

  it("consulta a los diez segundos, pausa en segundo plano y se detiene al desmontar", async () => {
    const api = apiDeFicha()
    await mostrarFicha(api as unknown as ApiEntrenamiento)
    expect(screen.getByText("Lara García")).toBeOnTheScreen()
    await act(async () => jest.advanceTimersByTime(9999))
    expect(api.molestias).toHaveBeenCalledTimes(1)
    await act(async () => jest.advanceTimersByTime(1))
    expect(api.molestias).toHaveBeenCalledTimes(2)
    AppState.currentState = "background"
    await act(async () => jest.advanceTimersByTime(20000))
    expect(api.molestias).toHaveBeenCalledTimes(2)
    AppState.currentState = "active"
    await act(async () => jest.advanceTimersByTime(10000))
    expect(api.molestias).toHaveBeenCalledTimes(3)
    await screen.unmount()
    await act(async () => jest.advanceTimersByTime(20000))
    expect(api.molestias).toHaveBeenCalledTimes(3)
  })

  it("espera a la consulta pendiente antes de iniciar otro sondeo", async () => {
    const api = apiDeFicha()
    let resolver!: (valor: { molestias: Molestia[]; total: number }) => void
    api.molestias.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )
    await mostrarFicha(api as unknown as ApiEntrenamiento)
    await act(async () => jest.advanceTimersByTime(30000))
    expect(api.molestias).toHaveBeenCalledTimes(1)
    await act(async () => resolver({ molestias: [], total: 0 }))
    await act(async () => jest.advanceTimersByTime(10000))
    expect(api.molestias).toHaveBeenCalledTimes(2)
  })

  it("muestra la ficha disponible aunque falle molestias y permite reintentar", async () => {
    const api = apiDeFicha()
    api.molestias.mockRejectedValueOnce(new Error("sin red"))
    await mostrarFicha(api as unknown as ApiEntrenamiento)
    expect(screen.getByText("Lara García")).toBeOnTheScreen()
    expect(screen.getByRole("alert")).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
    expect(api.molestias).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("conserva las molestias ya cargadas cuando falla el refresco", async () => {
    const api = apiDeFicha()
    api.molestias
      .mockResolvedValueOnce({
        total: 1,
        molestias: [
          {
            id: "molestia",
            sesionId,
            nivel: "ambar",
            zona: "otra",
            intensidad: 5,
            sintomas: [],
            estado: "abierta",
          } as unknown as Molestia,
        ],
      })
      .mockRejectedValueOnce(new Error("sin red"))
    await mostrarFicha(api as unknown as ApiEntrenamiento)
    expect(screen.getByText("Molestia ámbar en otra zona")).toBeOnTheScreen()
    await act(async () => jest.advanceTimersByTime(10000))
    expect(api.molestias).toHaveBeenCalledTimes(2)
    expect(screen.getByText("Lara García")).toBeOnTheScreen()
    expect(screen.getByText("Molestia ámbar en otra zona")).toBeOnTheScreen()
    expect(screen.getByRole("alert")).toBeOnTheScreen()
  })

  it.each(
    (
      ["ficha", "plan", "resultados", "molestias", "dieta", "medidas", "consentimiento"] as const
    ).flatMap((origen) => [
      {
        origen,
        fallo: new ErrorDePermiso(),
        mensaje: "No tienes permiso para acceder a estos datos.",
      },
      { origen, fallo: new ErrorDeSesion(), mensaje: "Tu sesión ha caducado. Vuelve a entrar." },
    ]),
  )(
    "oculta los datos si $origen rechaza la autorización con $fallo",
    async ({ origen, fallo, mensaje }) => {
      const api = apiDeFicha()
      const consultas = {
        ficha: jest.fn(async () => ({ nombre: "Lara", apellidos: "García" }) as FichaDeUsuario),
        plan: api.plan,
        resultados: api.resultados,
        molestias: api.molestias,
        dieta: jest.fn(async () => null),
        medidas: jest.fn(async () => ({ medidas: [], fechaNacimiento: null })),
        consentimiento: jest.fn(async () => null),
      }
      await mostrarFicha(api as unknown as ApiEntrenamiento, {
        leerFicha: consultas.ficha,
        nutricion: { vigente: consultas.dieta } as unknown as ApiNutricion,
        seguimiento: {
          medidas: consultas.medidas,
          consentimiento: consultas.consentimiento,
        } as unknown as ApiSeguimiento,
      })
      expect(screen.getByText("Lara García")).toBeOnTheScreen()
      consultas[origen].mockRejectedValueOnce(fallo)

      await act(async () => jest.advanceTimersByTime(10000))

      expect(screen.queryByText("Lara García")).toBeNull()
      expect(screen.queryByRole("tab")).toBeNull()
      expect(screen.queryByRole("button", { name: "Crear plan nuevo" })).toBeNull()
      expect(screen.getByRole("alert")).toHaveTextContent(mensaje)
    },
  )

  it("un sondeo anterior no vuelve a abrir una molestia después de responderla", async () => {
    const abierta = {
      id: "molestia",
      sesionId,
      nivel: "ambar",
      zona: "otra",
      intensidad: 5,
      sintomas: [],
      estado: "abierta",
    } as unknown as Molestia
    const atendida: Molestia = { ...abierta, estado: "atendida", respuesta: "Reduce la carga" }
    const api = {
      ...apiDeFicha(),
      atenderMolestia: jest.fn(async () => atendida),
    }
    api.molestias
      .mockResolvedValue({ molestias: [atendida], total: 1 })
      .mockResolvedValueOnce({ molestias: [abierta], total: 1 })
    await mostrarFicha(api as unknown as ApiEntrenamiento)
    let resolver!: (valor: { molestias: Molestia[]; total: number }) => void
    api.molestias.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    )
    await act(async () => jest.advanceTimersByTime(10000))
    await fireEvent.press(
      screen.getByRole("button", { name: "Responder: Molestia ámbar en otra zona" }),
    )
    await fireEvent.changeText(
      screen.getByLabelText("Respuesta para el cliente"),
      "Reduce la carga",
    )
    await fireEvent.press(screen.getByRole("button", { name: "Enviar respuesta" }))
    expect(api.atenderMolestia).toHaveBeenCalledWith("molestia", "Reduce la carga")
    expect(screen.queryByText("Molestia ámbar en otra zona")).toBeNull()

    await act(async () => resolver({ molestias: [abierta], total: 1 }))

    expect(screen.queryByText("Molestia ámbar en otra zona")).toBeNull()
    await act(async () => jest.advanceTimersByTime(10000))
    expect(api.molestias).toHaveBeenCalledTimes(3)
    expect(screen.queryByText("Molestia ámbar en otra zona")).toBeNull()
  })
})

it.each(["C", "fuera-del-listado"])(
  "Ver sesión abre la sesión de la molestia (%s) y Última sesión la más reciente",
  async (destino) => {
    const resultados: ListadoResultados["resultados"] = ["A", "B", "C"].map((nombre) => ({
      agenda: {
        id: nombre,
        clienteId,
        fechaOriginal: "2026-10-01",
        fechaActual: "2026-10-01",
        estado: "cerrada",
        revision: 0,
      },
      resultado: {
        sesionId: nombre,
        prescripcion: { nombre, ejercicios: [] },
        revisionPrescripcion: 0,
        enviadoEn: "2026-10-01T10:00:00.000Z",
        notas: null,
        series: [],
      },
    }))
    const api = {
      plan: async () => ({ plan: null }),
      resultados: async () => ({ resultados }),
      molestias: async () => ({
        molestias: [
          {
            id: "molestia",
            sesionId: destino,
            nivel: "ambar",
            zona: "otra",
            intensidad: 5,
            sintomas: [],
            estado: "abierta",
          } as unknown as Molestia,
        ],
      }),
      novedades: async () => ({ novedades: [], total: 0, sinLeer: 0 }),
      comentarios: jest.fn(async () => ({ comentarios: [] })),
    } as unknown as ApiEntrenamiento
    await render(
      <FichaCliente
        clienteId={clienteId}
        cuentaId={clienteId}
        leerFicha={async () => ({ nombre: "Lara", apellidos: "García" }) as FichaDeUsuario}
        api={api}
        seguimiento={
          {
            medidas: async () => ({ medidas: [], fechaNacimiento: null }),
            consentimiento: async () => null,
          } as unknown as ApiSeguimiento
        }
        nutricion={{ vigente: async () => null } as unknown as ApiNutricion}
        valoraciones={
          { listar: async () => ({ total: 0, valoraciones: [] }) } as unknown as ApiValoraciones
        }
        medios={{} as ApiMedios}
        nuevoId={() => clienteId}
        editarPlan={jest.fn()}
        verSemana={jest.fn()}
        abrirNutricion={jest.fn()}
      />,
    )

    await screen.findByText("Molestia ámbar en otra zona")
    await fireEvent.press(screen.getAllByRole("button", { name: "Ver sesión" })[0]!)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/entrenamiento/[id]",
      params: { id: destino, nombre: "Lara García" },
    })
    expect(api.comentarios).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByRole("tab", { name: "Resumen" }))
    await fireEvent.press(screen.getByRole("button", { name: "Revisar sesión" }))
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: "/entrenamiento/[id]",
      params: { id: "A", nombre: "Lara García" },
    })
  },
)

it("cambiar de pestaña conserva el editor de valoraciones abierto", async () => {
  await render(
    <FichaCliente
      clienteId={clienteId}
      cuentaId={clienteId}
      leerFicha={async () => ({ nombre: "Lara", apellidos: "García" }) as FichaDeUsuario}
      api={
        {
          plan: async () => ({ plan: null }),
          resultados: async () => ({ resultados: [] }),
          molestias: async () => ({ molestias: [] }),
          novedades: async () => ({ novedades: [], total: 0, sinLeer: 0 }),
        } as unknown as ApiEntrenamiento
      }
      seguimiento={
        {
          medidas: async () => ({ medidas: [], fechaNacimiento: null }),
          consentimiento: async () => null,
        } as unknown as ApiSeguimiento
      }
      nutricion={{ vigente: async () => null } as unknown as ApiNutricion}
      valoraciones={
        { listar: async () => ({ total: 0, valoraciones: [] }) } as unknown as ApiValoraciones
      }
      medios={{} as ApiMedios}
      nuevoId={() => clienteId}
      editarPlan={jest.fn()}
      verSemana={jest.fn()}
      abrirNutricion={jest.fn()}
    />,
  )
  await fireEvent.press(await screen.findByRole("tab", { name: "Progreso" }))
  await fireEvent.changeText(screen.getByLabelText("Valoración en edición"), "Datos pendientes")
  await fireEvent.press(screen.getByRole("tab", { name: "Resumen" }))
  expect(screen.getByRole("tab", { name: "Progreso" }).props.accessibilityState.selected).toBe(true)
  await fireEvent.press(screen.getByRole("tab", { name: "Progreso" }))
  expect(screen.getByDisplayValue("Datos pendientes")).toBeTruthy()
})

it("Resumen reserva las novedades para Notificaciones", async () => {
  const api = apiDeFicha()
  await mostrarFicha(api as unknown as ApiEntrenamiento)
  await screen.findByRole("button", { name: "Crear plan nuevo" })
  expect(api.novedades).not.toHaveBeenCalled()
})

it("muestra cabecera propia y cinco pestañas; las molestias se atienden desde Resumen", async () => {
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento)
  expect(screen.getByText("ACTIVO")).toBeOnTheScreen()
  expect(
    StyleSheet.flatten(screen.getByRole("header", { name: "Lara García" }).props.style),
  ).toMatchObject({ fontSize: 34, lineHeight: 38 })
  expect(screen.getByTestId("ficha-accion-semana")).toHaveStyle({ flex: 1 })
  expect(screen.getByTestId("ficha-accion-plan")).toHaveStyle({ flex: 1 })
  expect(screen.queryByRole("tab", { name: "Check-ins y molestias" })).toBeNull()
  expect(screen.queryByRole("tab", { name: "Molestias" })).toBeNull()
  expect(screen.getAllByRole("tab").map((tab) => tab.props.accessibilityLabel)).toEqual([
    "Resumen",
    "Sesiones",
    "Progreso",
    "Nutrición",
    "Salud",
  ])
  expect(screen.queryByText("Check-ins")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(mockReplace).toHaveBeenCalledWith("/cartera")
})

it("volver utiliza el historial cuando la ficha se abrió desde otra pantalla", async () => {
  mockCanGoBack.mockReturnValueOnce(true)
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento)
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(mockBack).toHaveBeenCalledTimes(1)
})

it("Semana conserva el nombre completo del cliente para la revisión", async () => {
  const verSemana = jest.fn()
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento, { verSemana })
  await fireEvent.press(screen.getByRole("button", { name: "Semana" }))
  expect(verSemana).toHaveBeenCalledWith("Lara García")
})

it("la carga inicial usa esqueletos de cabecera y tarjetas", async () => {
  const api = apiDeFicha()
  api.plan.mockImplementationOnce(() => new Promise(() => undefined))
  await mostrarFicha(api as unknown as ApiEntrenamiento)
  expect(screen.queryByText("Cargando la ficha…")).toBeNull()
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThanOrEqual(4)
})

it("Salud permite abrir la administración de datos y acceso del cliente", async () => {
  await mostrarFicha(apiDeFicha() as unknown as ApiEntrenamiento)
  await fireEvent.press(screen.getByRole("tab", { name: "Salud" }))
  await fireEvent.press(screen.getByRole("button", { name: "Datos y acceso" }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/cliente/[id]", params: { id: clienteId } })
})

it("consulta solo la revisión de la última en Resumen y carga el resto al entrar en Sesiones", async () => {
  const api = apiDeFicha()
  const resultados: ListadoResultados["resultados"] = ["A", "B"].map((id) => ({
    agenda: {
      id,
      clienteId,
      fechaOriginal: "2026-10-01",
      fechaActual: "2026-10-01",
      estado: "cerrada",
      revision: 0,
    },
    resultado: {
      sesionId: id,
      prescripcion: { nombre: id, ejercicios: [] },
      revisionPrescripcion: 0,
      enviadoEn: "2026-10-01T10:00:00Z",
      notas: null,
      series: [],
    },
  }))
  api.resultados.mockResolvedValue({ resultados })
  const leerEntrenador = jest.fn(async () => ({ revisadaEn: null }))
  await mostrarFicha({ ...api, leerEntrenador } as unknown as ApiEntrenamiento)
  expect(leerEntrenador).toHaveBeenCalledTimes(1)
  expect(leerEntrenador).toHaveBeenCalledWith("A")
  await fireEvent.press(screen.getByRole("tab", { name: "Sesiones" }))
  expect(leerEntrenador).toHaveBeenCalledTimes(3)
  expect(leerEntrenador).toHaveBeenLastCalledWith("B")
})

it("una revisión sin permiso oculta también el resto de la ficha", async () => {
  const api = apiDeFicha()
  api.resultados.mockResolvedValue({
    resultados: [
      {
        agenda: {
          id: sesionId,
          clienteId,
          fechaOriginal: "2026-10-01",
          fechaActual: "2026-10-01",
          estado: "cerrada",
          revision: 0,
        },
        resultado: {
          sesionId,
          prescripcion: { nombre: "A", ejercicios: [] },
          revisionPrescripcion: 0,
          enviadoEn: "2026-10-01T10:00:00Z",
          notas: null,
          series: [],
        },
      },
    ],
  })
  await mostrarFicha({
    ...api,
    leerEntrenador: jest.fn(async () => {
      throw new ErrorDePermiso()
    }),
  } as unknown as ApiEntrenamiento)
  expect(screen.queryByText("Lara García")).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No tienes permiso para acceder a estos datos.",
  )
})
