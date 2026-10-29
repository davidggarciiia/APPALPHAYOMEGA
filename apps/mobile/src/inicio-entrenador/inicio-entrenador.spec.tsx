import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, AppState, type AppStateStatus } from "react-native"
import { ResumenSemanalSchema, type ResumenSemanal } from "@alpha-omega/shared"
import { withTiming } from "react-native-reanimated"

import { ErrorDePermiso } from "../lib/http"
import { cargarTrabajo, type TrabajoEntrenador } from "./cargar-trabajo"
import { InicioEntrenador } from "./inicio-entrenador"

let mockEnfocada = true
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) => {
    jest.requireActual<typeof import("react")>("react").useEffect(() => {
      if (mockEnfocada) return efecto()
    }, [efecto, mockEnfocada])
  },
}))
jest.mock("./cargar-trabajo", () => ({
  cargarTrabajo: jest.fn(),
  ACTIVOS_POR_PAGINA: 4,
  ACTIVACIONES_POR_PAGINA: 8,
}))
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  withTiming: jest.fn((valor: number) => valor),
}))

type Cliente = ResumenSemanal["clientes"][number]
const cliente: Cliente = {
  clienteId: "a",
  nombre: "Ana",
  apellidos: "López",
  sesionesPrevistas: 3,
  sesionesEnviadas: 2,
  ejercicios: [
    {
      ejercicioId: "press",
      nombre: "Press inclinado",
      mejorSerie: {
        sesionId: "s",
        fecha: "2026-10-28",
        pesoKg: 62.5,
        repeticiones: 10,
        rir: null,
        estimado1RM: 83.3,
      },
      mejorSerieAnterior: {
        sesionId: "p",
        fecha: "2026-10-20",
        pesoKg: 60,
        repeticiones: 9,
        rir: 2,
        estimado1RM: 78,
      },
      comparacion: {
        direccion: "sube",
        diferenciaKg: 2.5,
        diferenciaRepeticiones: 1,
        diferencia1RM: 5.3,
      },
      estado: "Progresa",
      record: true,
    },
  ],
  molestiasAbiertas: [],
}
const vacio: TrabajoEntrenador = {
  activos: { usuarios: [], total: 0 },
  pendientes: { usuarios: [], total: 0 },
  clientes: [],
}
const resumen = (clientes: Cliente[] = []): ResumenSemanal => ({ semana: "2026-10-26", clientes })
const pedir = jest.fn()
const abrir = jest.fn()
const vista = (): React.JSX.Element => (
  <InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />
)
let actividad: (estado: AppStateStatus) => void

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-29T10:00:00Z") })
  mockEnfocada = true
  AppState.currentState = "active"
  jest.spyOn(AppState, "addEventListener").mockImplementation((_evento, oyente) => {
    actividad = oyente
    return { remove: jest.fn() }
  })
  jest.mocked(cargarTrabajo).mockResolvedValue(vacio)
  pedir.mockResolvedValue(resumen())
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it("consulta el agregado actual y muestra el vacío sin títulos de relleno", async () => {
  await render(vista())
  expect(await screen.findByText("Aún no tienes clientes activos")).toBeOnTheScreen()
  expect(pedir).toHaveBeenCalledWith(
    "/entrenamiento/resumen-semanal?semana=2026-10-26",
    ResumenSemanalSchema,
    expect.objectContaining({ signal: expect.anything() }),
  )
  expect(screen.getByText("26 oct — 1 nov")).toBeOnTheScreen()
  expect(screen.queryByText("Qué toca hoy")).toBeNull()
  expect(screen.queryByText("Todo al día")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Ver todos los clientes" }))
  expect(abrir).toHaveBeenLastCalledWith("/cartera")
})

it("muestra serie, RIR desconocido, diferencia, estado y récord y abre la ficha", async () => {
  pedir.mockResolvedValue(resumen([cliente]))
  await render(vista())
  expect(await screen.findByText("Ana López")).toBeOnTheScreen()
  for (const texto of [
    "2 de 3 sesiones enviadas",
    "62,5 kg × 10 @ RIR —",
    "Sube · +2,5 kg · +1 rep",
    "Progresa",
    "Récord",
  ])
    expect(screen.getByText(texto)).toBeOnTheScreen()
  expect(screen.queryByText(/Sube carga/)).toBeNull()
  expect(
    screen.getByRole("button", { name: "Ver todos los ejercicios de Ana López" }),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: /^Ver ficha de Ana López/ }))
  expect(abrir).toHaveBeenLastCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "a" },
  })
})

it("ordena los 15 activos por atención y nombre sin paginar ni duplicar molestias", async () => {
  const sinEnvios = {
    ...cliente,
    clienteId: "b",
    nombre: "Berta",
    sesionesEnviadas: 0,
    ejercicios: [],
  }
  const baja = {
    ...cliente,
    clienteId: "c",
    nombre: "Carlos",
    ejercicios: [{ ...cliente.ejercicios[0]!, estado: "Baja" as const }],
  }
  const molestia = {
    ...cliente,
    clienteId: "z",
    nombre: "Zoe",
    molestiasAbiertas: [
      {
        id: "m",
        sesionId: "s",
        zona: "hombro" as const,
        intensidad: 5,
        nivel: "ambar" as const,
        creadaEn: "2026-10-28T10:00:00Z",
      },
      {
        id: "m2",
        sesionId: "s",
        zona: "codo" as const,
        intensidad: 3,
        nivel: "verde" as const,
        creadaEn: "2026-10-28T10:00:00Z",
      },
    ],
  }
  const resto = Array.from({ length: 11 }, (_, n) => ({
    ...cliente,
    clienteId: `n${n}`,
    nombre: `María ${n.toString().padStart(2, "0")}`,
  }))
  pedir.mockResolvedValue(resumen([cliente, ...resto, molestia, baja, sinEnvios]))
  await render(vista())
  const tarjetas = await screen.findAllByRole("button", { name: /^Ver ficha de/ })
  expect(tarjetas).toHaveLength(15)
  expect(tarjetas.slice(0, 4).map((t) => t.props.accessibilityLabel.split(". ")[0])).toEqual([
    "Ver ficha de Berta López",
    "Ver ficha de Carlos López",
    "Ver ficha de Zoe López",
    "Ver ficha de Ana López",
  ])
  expect(screen.getByText("Sin envíos esta semana")).toBeOnTheScreen()
  expect(screen.getAllByText("Hombro · 5 de 10 · abierta")).toHaveLength(1)
  expect(screen.getAllByText("Codo · 3 de 10 · abierta")).toHaveLength(1)
  await fireEvent.press(screen.getByRole("button", { name: /^Ver ficha de Zoe López/ }))
  expect(abrir).toHaveBeenLastCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "z" },
  })
})

it("no considera atención una bajada aislada, el martes sin envíos o una semana sin sesiones", async () => {
  jest.setSystemTime(new Date("2026-10-27T10:00:00Z"))
  pedir.mockResolvedValue(
    resumen([
      { ...cliente, nombre: "Zoe", sesionesEnviadas: 0 },
      {
        ...cliente,
        clienteId: "b",
        nombre: "Berta",
        ejercicios: [
          {
            ...cliente.ejercicios[0]!,
            estado: null,
            comparacion: {
              direccion: "baja",
              diferenciaKg: -2.5,
              diferenciaRepeticiones: -1,
              diferencia1RM: -5,
            },
          },
        ],
      },
      { ...cliente, clienteId: "c", nombre: "Ana", sesionesPrevistas: 0, sesionesEnviadas: 0 },
    ]),
  )
  await render(vista())
  expect(
    (await screen.findAllByRole("button", { name: /^Ver ficha de/ })).map(
      (t) => t.props.accessibilityLabel.split(". ")[0],
    ),
  ).toEqual(["Ver ficha de Ana López", "Ver ficha de Berta López", "Ver ficha de Zoe López"])
  expect(screen.queryByText("Sin envíos desde el lunes")).toBeNull()
  expect(screen.queryByText("Sin plan esta semana")).toBeNull()
  expect(screen.getByText("Baja · −2,5 kg · −1 rep")).toBeOnTheScreen()
})

it("distingue igualdad, falta de marca y primera marca sin inventar comparación", async () => {
  pedir.mockResolvedValue(
    resumen([
      {
        ...cliente,
        ejercicios: [
          {
            ...cliente.ejercicios[0]!,
            comparacion: {
              direccion: "igual",
              diferenciaKg: 0,
              diferenciaRepeticiones: 0,
              diferencia1RM: 0,
            },
            estado: "Estancado",
            record: false,
          },
          {
            ...cliente.ejercicios[0]!,
            ejercicioId: "sentadilla",
            nombre: "Sentadilla",
            mejorSerie: null,
            comparacion: null,
            estado: null,
            record: false,
          },
          {
            ...cliente.ejercicios[0]!,
            ejercicioId: "remo",
            nombre: "Remo",
            mejorSerieAnterior: null,
            comparacion: null,
            estado: null,
          },
        ],
      },
    ]),
  )
  await render(vista())
  for (const texto of ["Igual", "Estancado", "Sin marca esta semana", "Sin comparación anterior"])
    expect(await screen.findByText(texto)).toBeOnTheScreen()
})

it("muestra plan sin acciones de revisión en la tarjeta y conserva activación y paginación con alcance", async () => {
  pedir.mockResolvedValue(resumen([cliente]))
  const usuario = { id: "a", nombre: "Ana", apellidos: "López" } as never
  jest.mocked(cargarTrabajo).mockResolvedValue({
    activos: { usuarios: [usuario], total: 12 },
    pendientes: { usuarios: [{ id: "p", nombre: "Paz", apellidos: "López" } as never], total: 9 },
    clientes: [
      {
        cliente: usuario,
        sinPlan: true,
      },
    ],
  })
  await render(vista())
  expect(await screen.findByText("Planes · 1–1 de 12")).toBeOnTheScreen()
  expect(screen.getAllByText("Ana López")).toHaveLength(1)
  expect(screen.queryByRole("button", { name: /revisar/i })).toBeNull()
  expect(screen.queryByText(/sin revisar|revisada|por revisar/i)).toBeNull()
  for (const [nombre, ruta] of [
    [
      "Crear plan para Ana López",
      { pathname: "/entrenador/cliente/[id]/plan", params: { id: "a" } },
    ],
    ["Activar a Paz López", { pathname: "/cliente/[id]", params: { id: "p" } }],
  ] as const) {
    await fireEvent.press(await screen.findByRole("button", { name: nombre }))
    expect(abrir).toHaveBeenLastCalledWith(ruta)
  }
  await fireEvent.press(screen.getByRole("button", { name: "Siguientes clientes activos" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 4, 0)
  await fireEvent.press(screen.getByRole("button", { name: "Siguientes pendientes de activar" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 4, 8)
  await fireEvent.press(screen.getByRole("button", { name: "Clientes activos anteriores" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 0, 8)
  expect(pedir).toHaveBeenCalledTimes(1)
})

it("resume una semana sin marcas en una línea con la última sesión enviada", async () => {
  pedir.mockResolvedValue(
    resumen([
      {
        ...cliente,
        sesionesEnviadas: 0,
        ultimaFechaEnviada: "2026-10-23",
        ejercicios: Array.from({ length: 8 }, (_, n) => ({
          ...cliente.ejercicios[0]!,
          ejercicioId: `ejercicio-${n}`,
          nombre: `Ejercicio ${n}`,
          mejorSerie: null,
          comparacion: null,
          record: false,
        })),
      },
    ]),
  )
  await render(vista())
  const texto = "Sin envíos esta semana · último: viernes 23 oct"
  expect(await screen.findByText(texto)).toBeOnTheScreen()
  expect(screen.queryByText(/Ejercicio \d/)).toBeNull()
  expect(screen.queryByText("Sin marca esta semana")).toBeNull()
  expect(screen.queryByText("Sin envíos desde el lunes")).toBeNull()
  expect(screen.queryByRole("button", { name: /Ver todos los ejercicios/ })).toBeNull()
  expect(screen.getByRole("button", { name: /^Ver ficha de Ana López/ })).toHaveProp(
    "accessibilityLabel",
    expect.stringContaining(texto),
  )
})

it("no inventa una fecha si no hay historial ni confunde envíos sin marcas con falta de envíos", async () => {
  pedir.mockResolvedValue(
    resumen([
      { ...cliente, sesionesEnviadas: 0, ejercicios: [], ultimaFechaEnviada: null },
      { ...cliente, clienteId: "b", nombre: "Berta", ejercicios: [] },
    ]),
  )
  await render(vista())
  expect(await screen.findByText("Sin envíos esta semana")).toBeOnTheScreen()
  expect(screen.getByText("Sin marcas esta semana")).toBeOnTheScreen()
  expect(screen.queryByText(/último:/)).toBeNull()
})

it("muestra cuatro ejercicios como máximo, prioriza marcas e historial y enlaza a Progreso", async () => {
  const ejercicio = cliente.ejercicios[0]!
  pedir.mockResolvedValue(
    resumen([
      {
        ...cliente,
        ejercicios: [
          {
            ...ejercicio,
            ejercicioId: "ausente",
            nombre: "Ausente",
            mejorSerie: null,
            sesionesConMarca: 100,
          },
          ...[2, 4, 7, 1, 10].map((sesionesConMarca) => ({
            ...ejercicio,
            ejercicioId: `ejercicio-${sesionesConMarca}`,
            nombre: `Ejercicio ${sesionesConMarca}`,
            sesionesConMarca,
          })),
        ],
      },
    ]),
  )
  await render(vista())
  expect((await screen.findAllByText(/^Ejercicio /)).map((nodo) => nodo.props.children)).toEqual([
    "Ejercicio 10",
    "Ejercicio 7",
    "Ejercicio 4",
    "Ejercicio 2",
  ])
  expect(screen.queryByText("Ausente")).toBeNull()
  expect(screen.queryByText("Ejercicio 1")).toBeNull()
  const tarjeta = screen.getByRole("button", { name: /^Ver ficha de Ana López/ })
  expect(tarjeta.props.accessibilityLabel).not.toContain("Ausente")
  expect(tarjeta.props.accessibilityLabel).not.toContain("Ejercicio 1.")
  await fireEvent.press(
    screen.getByRole("button", { name: "Ver todos los ejercicios de Ana López" }),
  )
  expect(abrir).toHaveBeenLastCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: "a", pestana: "progreso" },
  })
})

it("cambia semanas sin aceptar respuestas tardías ni permitir semanas futuras", async () => {
  let resolver!: (datos: ResumenSemanal) => void
  pedir.mockReturnValueOnce(
    new Promise((r) => {
      resolver = r
    }),
  )
  await render(vista())
  expect(screen.getByLabelText("Cargando resumen semanal")).toHaveProp("accessibilityState", {
    busy: true,
  })
  pedir.mockResolvedValueOnce({
    ...resumen([{ ...cliente, ejercicios: [] }]),
    semana: "2026-10-19",
  })
  await fireEvent.press(screen.getByRole("button", { name: "Semana anterior" }))
  expect(pedir).toHaveBeenLastCalledWith(
    "/entrenamiento/resumen-semanal?semana=2026-10-19",
    ResumenSemanalSchema,
    expect.anything(),
  )
  expect(await screen.findByText("Sin marcas esta semana")).toBeOnTheScreen()
  await act(() => resolver(resumen([{ ...cliente, nombre: "Tardía" }])))
  expect(screen.queryByText("Tardía López")).toBeNull()
  expect(screen.getByText("19 oct — 25 oct")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Semana siguiente" }))
  expect(screen.getByRole("button", { name: "Semana siguiente" })).toBeDisabled()
})

it("reintenta un fallo y conserva marcas ante un error de actualización", async () => {
  pedir.mockRejectedValueOnce(new Error("Sin red"))
  await render(vista())
  expect(await screen.findByRole("alert")).toBeOnTheScreen()
  pedir.mockResolvedValueOnce(resumen([cliente]))
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByText("Ana López")).toBeOnTheScreen()
  pedir.mockRejectedValueOnce(new Error("Sin red"))
  await act(async () => {
    jest.advanceTimersByTime(10000)
  })
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  expect(screen.getByText("Ana López")).toBeOnTheScreen()
})

it("oculta datos si se revoca el permiso y detiene reintentos automáticos", async () => {
  pedir.mockResolvedValueOnce(resumen([cliente]))
  await render(vista())
  pedir.mockRejectedValueOnce(new ErrorDePermiso())
  await act(async () => {
    jest.advanceTimersByTime(10000)
  })
  expect(screen.getByRole("alert")).toHaveTextContent(/No tienes permiso/)
  expect(screen.queryByText("Ana López")).toBeNull()
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
  await act(async () => {
    jest.advanceTimersByTime(30000)
  })
  expect(pedir).toHaveBeenCalledTimes(2)
})

it("refresca cada 10 s sin recargar tareas ni solapar consultas", async () => {
  await render(vista())
  await act(async () => {
    jest.advanceTimersByTime(9999)
  })
  expect(pedir).toHaveBeenCalledTimes(1)
  let resolver!: (datos: ResumenSemanal) => void
  pedir.mockReturnValueOnce(
    new Promise((r) => {
      resolver = r
    }),
  )
  await act(async () => {
    jest.advanceTimersByTime(1)
  })
  expect(pedir).toHaveBeenCalledTimes(2)
  await act(async () => {
    jest.advanceTimersByTime(30000)
  })
  expect(pedir).toHaveBeenCalledTimes(2)
  await act(() => resolver(resumen()))
  await act(async () => {
    jest.advanceTimersByTime(10000)
  })
  expect(pedir).toHaveBeenCalledTimes(3)
  expect(cargarTrabajo).toHaveBeenCalledTimes(1)
})

it("pausa en segundo plano y al perder foco y refresca al volver", async () => {
  await render(vista())
  await act(() => actividad("background"))
  await act(async () => {
    jest.advanceTimersByTime(30000)
  })
  expect(pedir).toHaveBeenCalledTimes(1)
  await act(() => actividad("active"))
  expect(pedir).toHaveBeenCalledTimes(2)
  mockEnfocada = false
  await screen.rerender(vista())
  await act(async () => {
    jest.advanceTimersByTime(30000)
    actividad("active")
  })
  expect(pedir).toHaveBeenCalledTimes(2)
  mockEnfocada = true
  await screen.rerender(vista())
  expect(pedir).toHaveBeenCalledTimes(3)
})

it("no consulta inactiva y cancela al desmontar", async () => {
  AppState.currentState = "background"
  pedir.mockReturnValueOnce(new Promise(() => undefined))
  await render(vista())
  expect(pedir).not.toHaveBeenCalled()
  await act(() => actividad("active"))
  const signal = pedir.mock.calls[0]![2].signal as AbortSignal
  await screen.unmount()
  expect(signal.aborted).toBe(true)
  await act(async () => {
    jest.advanceTimersByTime(30000)
  })
  expect(pedir).toHaveBeenCalledTimes(1)
})

it("descarta una consulta cancelada en segundo plano aunque llegue después de reactivarse", async () => {
  let resolver!: (datos: ResumenSemanal) => void
  pedir.mockReturnValueOnce(
    new Promise((r) => {
      resolver = r
    }),
  )
  await render(vista())
  const signal = pedir.mock.calls[0]![2].signal as AbortSignal
  await act(() => actividad("background"))
  expect(signal.aborted).toBe(true)
  pedir.mockResolvedValueOnce(resumen([cliente]))
  await act(() => actividad("active"))
  await act(() => resolver(resumen([{ ...cliente, nombre: "Tardía" }])))
  expect(screen.getByText("Ana López")).toBeOnTheScreen()
  expect(screen.queryByText("Tardía López")).toBeNull()
})

it("mantiene el resumen si fallan tareas y ofrece su reintento independiente", async () => {
  jest.mocked(cargarTrabajo).mockRejectedValueOnce(new Error("Sin red"))
  pedir.mockResolvedValue(resumen([cliente]))
  await render(vista())
  expect(await screen.findByText("Ana López")).toBeOnTheScreen()
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las tareas.")
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(cargarTrabajo).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).toBeNull()
})

it("respeta movimiento reducido al mostrar tarjetas y cambiar de semana", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  pedir.mockResolvedValue(resumen([cliente]))
  await render(vista())
  expect(await screen.findByText("Press inclinado")).toBeOnTheScreen()
  jest.mocked(withTiming).mockClear()
  pedir.mockResolvedValue({ ...resumen([cliente]), semana: "2026-10-19" })
  await fireEvent.press(screen.getByRole("button", { name: "Semana anterior" }))
  expect(withTiming).not.toHaveBeenCalled()
})

it("anuncia las cargas en el nombre accesible aunque el lector omita las indicaciones", async () => {
  pedir.mockResolvedValue(resumen([cliente]))
  await render(vista())
  const tarjeta = await screen.findByRole("button", { name: /^Ver ficha de Ana López/ })
  expect(tarjeta.props.accessibilityLabel).toContain("62,5 kg × 10 @ RIR —")
  expect(tarjeta.props.accessibilityLabel).toContain("Sube · +2,5 kg · +1 rep")
})

it("conserva plan sin revisión si falla solo el agregado y no inventa las cifras semanales", async () => {
  pedir.mockRejectedValueOnce(new Error("Sin red"))
  jest.mocked(cargarTrabajo).mockResolvedValue({
    ...vacio,
    clientes: [
      {
        cliente: { id: "a", nombre: "Ana", apellidos: "López" } as never,
        sinPlan: true,
      },
    ],
  })
  await render(vista())
  expect(await screen.findByRole("button", { name: "Crear plan para Ana López" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: /revisar/i })).toBeNull()
  expect(screen.queryByText(/sesiones enviadas/)).toBeNull()
  expect(screen.getAllByText("Ana López")).toHaveLength(1)
})
