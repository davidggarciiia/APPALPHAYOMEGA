import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AppState, StyleSheet } from "react-native"
import { Profiler } from "react"
import type { FichaDeUsuario, ListadoResultados, Molestia, PlanVigente } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import type { ApiNutricion } from "../../nutricion/api"
import type { ApiSeguimiento } from "../../seguimiento/api"
import type { ApiMedios } from "../../seguimiento/medios-api"
import type { ApiValoraciones } from "../../seguimiento/valoraciones-api"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import { FichaCliente } from "./ficha-cliente"

const mockDatosDelCliente = jest.fn()
jest.mock("../../clientes/datos-del-cliente", () => ({
  DatosDelCliente: (props: { clienteId: string; alCerrar: () => void }) => {
    mockDatosDelCliente(props)
    const { Text, Pressable } = jest.requireActual<typeof import("react-native")>("react-native")
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar datos"
        onPress={props.alCerrar}
      >
        <Text>Formulario del cliente</Text>
      </Pressable>
    )
  },
}))
const mockPush = jest.fn(),
  mockBack = jest.fn(),
  mockReplace = jest.fn(),
  mockCanGoBack = jest.fn(() => false)
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
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
const clienteId = "30000000-0000-4000-8000-000000000000"
const perfil = {
  nombre: "Lara",
  apellidos: "García",
  estado: "activo",
  email: "lara@example.com",
  fechaNacimiento: "1990-05-12",
} as FichaDeUsuario
const molestia = {
  id: "molestia",
  sesionId: "A",
  nivel: "ambar",
  zona: "otra",
  intensidad: 5,
  sintomas: [],
  estado: "abierta",
  creadaEn: "2026-10-26T12:00:00Z",
} as unknown as Molestia
const plan = {
  id: "plan",
  nombre: "Mes 2",
  semanaInicial: "2026-10-26",
  semanas: 4,
  bloque: null,
} as PlanVigente
function resultado(
  id: string,
  revisadaEn: string | null = null,
): ListadoResultados["resultados"][number] {
  return {
    agenda: {
      id,
      clienteId,
      fechaOriginal: "2026-10-26",
      fechaActual: "2026-10-26",
      estado: "cerrada",
      revision: 0,
    },
    resultado: {
      sesionId: id,
      prescripcion: { nombre: id, ejercicios: [] },
      revisionPrescripcion: 0,
      enviadoEn: "2026-10-26T10:00:00Z",
      notas: null,
      series: [],
    },
    revisadaEn,
  }
}
function fuentes() {
  return {
    clienteId,
    cuentaId: "entrenador-A",
    leerFicha: jest.fn(async () => perfil),
    api: {
      plan: jest
        .fn<ReturnType<ApiEntrenamiento["plan"]>, Parameters<ApiEntrenamiento["plan"]>>()
        .mockResolvedValue({ plan: null }),
      semana: jest.fn(async () => ({ sesiones: [], total: 0 })),
      resultados: jest
        .fn<
          ReturnType<ApiEntrenamiento["resultados"]>,
          Parameters<ApiEntrenamiento["resultados"]>
        >()
        .mockResolvedValue({ resultados: [] }),
      molestias: jest
        .fn<ReturnType<ApiEntrenamiento["molestias"]>, Parameters<ApiEntrenamiento["molestias"]>>()
        .mockResolvedValue({ molestias: [], total: 0 }),
      atenderMolestia: jest.fn(
        async () => ({ ...molestia, estado: "atendida", respuesta: "Reduce la carga" }) as Molestia,
      ),
      leerEntrenador: jest.fn(),
      novedades: jest.fn(),
    },
    seguimiento: {
      medidas: jest.fn(async () => ({ medidas: [], fechaNacimiento: perfil.fechaNacimiento })),
      consentimiento: jest.fn(async () => null),
    },
    nutricion: { vigente: jest.fn(async () => null) },
    valoraciones: { listar: jest.fn(async () => ({ total: 0, valoraciones: [] })) },
    medios: {} as ApiMedios,
    nuevoId: () => clienteId,
    editarPlan: jest.fn(),
    verSemana: jest.fn(),
    abrirNutricion: jest.fn(),
  }
}
function vista(
  datos: ReturnType<typeof fuentes>,
  extras: Partial<Parameters<typeof FichaCliente>[0]> = {},
) {
  return (
    <FichaCliente
      {...datos}
      api={datos.api as unknown as ApiEntrenamiento}
      seguimiento={datos.seguimiento as unknown as ApiSeguimiento}
      nutricion={datos.nutricion as unknown as ApiNutricion}
      valoraciones={datos.valoraciones as unknown as ApiValoraciones}
      {...extras}
    />
  )
}
async function pasar(ms: number) {
  for (let n = 0; n < ms; n += 10000) await act(async () => jest.advanceTimersByTime(10000))
}
beforeEach(() => {
  AppState.currentState = "active"
  jest.useFakeTimers()
  jest.setSystemTime(new Date("2026-10-29T12:00:00Z"))
})
afterEach(() => jest.useRealTimers())
it("cliente nuevo: valoración principal, plan secundario y cuatro destinos sin pestañas", async () => {
  const datos = fuentes()
  await render(vista(datos))
  expect(datos.valoraciones.listar).toHaveBeenCalledWith(clienteId, 1)
  expect(screen.getByText("Sin plan todavía")).toBeOnTheScreen()
  expect(screen.queryByRole("tab")).toBeNull()
  for (const name of ["Sesiones", "Progreso", "Molestias"])
    expect(screen.queryByRole("button", { name })).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Empezar valoración" }))
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/entrenador/cliente/[id]/valoraciones",
    params: { id: clienteId, valoracionInicial: "1" },
  })
  await fireEvent.press(screen.getByRole("button", { name: "Crear plan" }))
  expect(datos.editarPlan).toHaveBeenCalledTimes(1)
})
it.each(["borrador", "publicada", "sin datos de visitas"])(
  "no propone inicial con %s",
  async (estado) => {
    const datos = fuentes()
    datos.valoraciones.listar.mockImplementation(async () => {
      if (estado === "sin datos de visitas") throw new Error("sin red")
      return { total: 1, valoraciones: [] }
    })
    await render(vista(datos))
    expect(screen.queryByRole("button", { name: "Empezar valoración" })).toBeNull()
  },
)
it.each([
  {
    entrada: { valoracionInicial: true },
    ruta: "/entrenador/cliente/[id]/valoraciones",
    params: { id: clienteId, valoracionInicial: "1" },
  },
  {
    entrada: { pestanaInicial: "progreso" as const },
    ruta: "/entrenador/cliente/[id]/progreso",
    params: { id: clienteId },
  },
])(
  "conserva el acceso antiguo $ruta en pantalla independiente",
  async ({ entrada, ruta, params }) => {
    await render(vista(fuentes(), entrada))
    expect(mockReplace).toHaveBeenCalledWith({ pathname: ruta, params })
  },
)
it.each(["cliente", "cuenta"])("aísla ficha y hoja al cambiar de %s", async (cambio) => {
  const datos = fuentes()
  await render(vista(datos))
  await fireEvent.press(screen.getByRole("button", { name: "Datos del cliente" }))
  let resolver!: (ficha: FichaDeUsuario) => void
  await screen.rerender(
    vista(datos, {
      ...(cambio === "cliente" ? { clienteId: "cliente-B" } : { cuentaId: "entrenador-B" }),
      leerFicha: () =>
        new Promise((resolve) => {
          resolver = resolve
        }),
    }),
  )
  expect(screen.queryByText("Lara García")).toBeNull()
  expect(screen.queryByText("Formulario del cliente")).toBeNull()
  expect(screen.getByLabelText("Cargando ficha")).toBeOnTheScreen()
  await act(async () => resolver({ ...perfil, nombre: "Bea" }))
  expect(screen.getByText("Bea García")).toBeOnTheScreen()
})
it("sondea actividad a 10 s y perfil a 60 s; pausa en segundo plano y al desmontar", async () => {
  const datos = fuentes()
  await render(vista(datos))
  await act(async () => jest.advanceTimersByTime(9999))
  expect(datos.api.molestias).toHaveBeenCalledTimes(1)
  await act(async () => jest.advanceTimersByTime(1))
  expect(datos.api.molestias).toHaveBeenCalledTimes(2)
  expect(datos.seguimiento.medidas).toHaveBeenCalledTimes(1)
  AppState.currentState = "background"
  await act(async () => jest.advanceTimersByTime(20000))
  expect(datos.api.molestias).toHaveBeenCalledTimes(2)
  AppState.currentState = "active"
  await pasar(30000)
  expect(datos.seguimiento.medidas).toHaveBeenCalledTimes(2)
  expect(datos.nutricion.vigente).toHaveBeenCalledTimes(2)
  const llamadas = datos.api.molestias.mock.calls.length
  await screen.unmount()
  await act(async () => jest.advanceTimersByTime(20000))
  expect(datos.api.molestias).toHaveBeenCalledTimes(llamadas)
})
it("un sondeo idéntico no repinta la ficha y una sesión nueva aparece al siguiente", async () => {
  const datos = fuentes()
  datos.api.resultados.mockImplementation(async () => ({ resultados: [resultado("A")] }))
  const repintar = jest.fn()
  await render(
    <Profiler id="ficha" onRender={repintar}>
      {vista(datos)}
    </Profiler>,
  )
  // La lista asienta su primer pintado con temporizadores propios; se mide solo el sondeo.
  await act(async () => jest.advanceTimersByTime(9000))
  repintar.mockClear()
  await act(async () => jest.advanceTimersByTime(1000))
  expect(datos.api.resultados).toHaveBeenCalledTimes(2)
  expect(repintar).not.toHaveBeenCalled()
  datos.api.resultados.mockResolvedValue({ resultados: [resultado("A"), resultado("B")] })
  await pasar(10000)
  expect(screen.getByText("2 enviadas")).toBeOnTheScreen()
})

it("el sondeo muestra el fallo y su recuperación aunque los datos no hayan cambiado", async () => {
  const datos = fuentes()
  await render(vista(datos))
  datos.api.molestias.mockRejectedValueOnce(new Error("sin red"))
  await pasar(10000)
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  await pasar(10000)
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.getByText("Lara García")).toBeOnTheScreen()
})

it("espera la consulta pendiente antes del siguiente sondeo", async () => {
  const datos = fuentes()
  let resolver!: (valor: { molestias: Molestia[]; total: number }) => void
  datos.api.molestias.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  await render(vista(datos))
  await act(async () => jest.advanceTimersByTime(30000))
  expect(datos.api.molestias).toHaveBeenCalledTimes(1)
  await act(async () => resolver({ molestias: [], total: 0 }))
  await act(async () => jest.advanceTimersByTime(10000))
  expect(datos.api.molestias).toHaveBeenCalledTimes(2)
})
it("un sondeo anterior al guardado conserva nombre y nacimiento nuevos", async () => {
  const datos = fuentes()
  await render(vista(datos))
  let resolver!: (ficha: FichaDeUsuario) => void
  datos.leerFicha.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  await pasar(60000)
  await fireEvent.press(screen.getByRole("button", { name: "Datos del cliente" }))
  const props = mockDatosDelCliente.mock.lastCall![0] as {
    alActualizar: (f: FichaDeUsuario) => void
  }
  await act(() => props.alActualizar({ ...perfil, nombre: "Ana", fechaNacimiento: "2000-05-12" }))
  await act(async () => resolver(perfil))
  expect(screen.getByText("Ana García")).toBeOnTheScreen()
  expect(mockDatosDelCliente).toHaveBeenLastCalledWith(
    expect.objectContaining({
      fichaInicial: expect.objectContaining({ fechaNacimiento: "2000-05-12" }),
    }),
  )
})
it("muestra datos parciales con error y permite reintentar", async () => {
  const datos = fuentes()
  datos.api.molestias.mockRejectedValueOnce(new Error("sin red"))
  await render(vista(datos))
  expect(screen.getByText("Lara García")).toBeOnTheScreen()
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(datos.api.molestias).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).toBeNull()
})
it("conserva copia y deshabilita Responder si falla el refresco", async () => {
  const datos = fuentes()
  datos.api.molestias
    .mockResolvedValueOnce({ molestias: [molestia], total: 1 })
    .mockRejectedValueOnce(new Error("sin red"))
  await render(vista(datos))
  await act(async () => jest.advanceTimersByTime(10000))
  expect(screen.getByText(/Sin conexión · copia de las/)).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /^Responder:/ })).toBeDisabled()
  expect(screen.getByText("Lara García")).toBeOnTheScreen()
})
it.each(
  (
    [
      "ficha",
      "plan",
      "semana",
      "resultados",
      "molestias",
      "dieta",
      "medidas",
      "consentimiento",
      "visitas",
    ] as const
  ).flatMap((origen) => [
    {
      origen,
      fallo: new ErrorDePermiso(),
      mensaje: "No tienes permiso para acceder a estos datos.",
    },
    { origen, fallo: new ErrorDeSesion(), mensaje: "Tu sesión ha caducado. Vuelve a entrar." },
  ]),
)("oculta datos si $origen deniega acceso con $fallo", async ({ origen, fallo, mensaje }) => {
  const datos = fuentes()
  await render(vista(datos))
  const consultas = {
    ficha: datos.leerFicha,
    plan: datos.api.plan,
    semana: datos.api.semana,
    resultados: datos.api.resultados,
    molestias: datos.api.molestias,
    dieta: datos.nutricion.vigente,
    medidas: datos.seguimiento.medidas,
    consentimiento: datos.seguimiento.consentimiento,
    visitas: datos.valoraciones.listar,
  }
  consultas[origen].mockRejectedValueOnce(fallo)
  await pasar(60000)
  expect(screen.queryByText("Lara García")).toBeNull()
  expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent(mensaje)
})
it("un sondeo anterior no reabre la molestia respondida", async () => {
  const datos = fuentes()
  datos.api.molestias.mockResolvedValue({ molestias: [molestia], total: 1 })
  await render(vista(datos))
  let resolver!: (valor: { molestias: Molestia[]; total: number }) => void
  datos.api.molestias.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve
      }),
  )
  await act(async () => jest.advanceTimersByTime(10000))
  await fireEvent.press(screen.getByRole("button", { name: /^Responder:/ }))
  await fireEvent.changeText(screen.getByLabelText("Respuesta para el cliente"), "Reduce la carga")
  await fireEvent.press(screen.getByRole("button", { name: "Enviar respuesta" }))
  expect(datos.api.atenderMolestia).toHaveBeenCalledWith("molestia", "Reduce la carga")
  await act(async () => resolver({ molestias: [molestia], total: 1 }))
  expect(screen.queryByRole("button", { name: /^Responder:/ })).toBeNull()
})
it("cabecera Anton y destinos sin tarjetas cuando no hay pendientes ni novedades", async () => {
  const datos = fuentes()
  datos.api.plan.mockResolvedValue({ plan })
  datos.valoraciones.listar.mockResolvedValue({ total: 1, valoraciones: [] })
  await render(vista(datos))
  expect(
    StyleSheet.flatten(screen.getByRole("header", { name: "Lara García" }).props.style),
  ).toMatchObject({ fontSize: 34, lineHeight: 38 })
  expect(screen.getByText("ACTIVO")).toBeOnTheScreen()
  expect(screen.getByText("Mes 2 · semana 1 de 4")).toBeOnTheScreen()
  for (const texto of ["Nada pendiente", "Última sesión", "Qué buscamos"])
    expect(screen.queryByText(texto)).toBeNull()
  expect(screen.queryByRole("button", { name: "Crear plan nuevo" })).toBeNull()
  expect(datos.api.novedades).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(mockReplace).toHaveBeenCalledWith("/cartera")
})
it("volver usa el historial", async () => {
  mockCanGoBack.mockReturnValueOnce(true)
  await render(vista(fuentes()))
  await fireEvent.press(screen.getByRole("button", { name: "Volver" }))
  expect(mockBack).toHaveBeenCalledTimes(1)
})
it("menú ⋯ abre datos, crear plan y la semana con nombre completo", async () => {
  const datos = fuentes()
  await render(vista(datos))
  await fireEvent.press(screen.getByRole("button", { name: "Más acciones" }))
  await fireEvent.press(screen.getByRole("button", { name: "Ver como cliente" }))
  expect(datos.verSemana).toHaveBeenCalledWith("Lara García")
  await fireEvent.press(screen.getByRole("button", { name: "Más acciones" }))
  await fireEvent.press(screen.getByRole("button", { name: "Crear plan nuevo" }))
  expect(datos.editarPlan).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Más acciones" }))
  await fireEvent.press(screen.getByRole("button", { name: "Datos del cliente" }))
  expect(screen.getByText("Formulario del cliente")).toBeOnTheScreen()
})
it("la carga inicial usa esqueletos accesibles", async () => {
  const datos = fuentes()
  datos.api.plan.mockImplementationOnce(() => new Promise(() => undefined))
  await render(vista(datos))
  expect(screen.getByLabelText("Cargando ficha").props.accessibilityState.busy).toBe(true)
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThanOrEqual(4)
})
it("Datos reutiliza hoja, enlace antiguo y actualiza el nombre", async () => {
  const alCerrarDatos = jest.fn()
  await render(vista(fuentes(), { datosIniciales: true, alCerrarDatos }))
  const props = mockDatosDelCliente.mock.lastCall![0] as {
    alActualizar: (f: FichaDeUsuario) => void
  }
  await act(() => props.alActualizar({ ...perfil, nombre: "Ana" }))
  expect(screen.getByText("Ana García")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Cerrar datos" }))
  expect(alCerrarDatos).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Datos del cliente" }))
  expect(mockDatosDelCliente).toHaveBeenLastCalledWith(expect.objectContaining({ clienteId }))
})
it("muestra los envíos sin contar revisiones y abre todas las sesiones", async () => {
  const datos = fuentes()
  datos.api.resultados.mockResolvedValue({
    resultados: [resultado("Empuje"), resultado("Tracción", "2026-10-27T12:00:00Z")],
  })
  await render(vista(datos))
  expect(datos.api.leerEntrenador).not.toHaveBeenCalled()
  expect(screen.queryAllByText(/revis/i)).toHaveLength(0)
  expect(screen.queryByRole("button", { name: /revis/i })).toBeNull()
  expect(screen.getByText("2 enviadas")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Sesiones" }))
  expect(mockPush).toHaveBeenLastCalledWith({
    pathname: "/entrenador/cliente/[id]/sesiones",
    params: { id: clienteId },
  })
})
it("las sesiones enviadas no desplazan la atención a molestias y fin de bloque", async () => {
  const datos = fuentes()
  datos.api.plan
    .mockResolvedValueOnce({ plan: { ...plan, semanas: 1 } })
    .mockResolvedValueOnce({ plan: null })
  datos.api.resultados.mockResolvedValue({ resultados: [resultado("A"), resultado("B")] })
  datos.api.molestias.mockResolvedValue({ molestias: [molestia], total: 1 })
  await render(vista(datos))
  expect(screen.queryAllByText(/revis/i)).toHaveLength(0)
  const acciones = screen
    .getAllByRole("button")
    .filter((boton) => /^(Responder|Preparar|Empezar):/.test(boton.props.accessibilityLabel ?? ""))
  expect(acciones.map((boton) => boton.props.accessibilityLabel)).toEqual([
    expect.stringMatching(/^Responder:/),
    expect.stringMatching(/^Preparar:/),
    expect.stringMatching(/^Empezar:/),
  ])
  await fireEvent.press(acciones[0]!)
  expect(screen.getByLabelText("Respuesta para el cliente")).toBeOnTheScreen()
})
it("consulta siguiente plan solo al final y prepara si no existe", async () => {
  const datos = fuentes()
  datos.api.plan
    .mockResolvedValueOnce({ plan: { ...plan, semanas: 1 } })
    .mockResolvedValueOnce({ plan: null })
  await render(vista(datos))
  await fireEvent.press(screen.getByRole("button", { name: /^Preparar:/ }))
  expect(datos.editarPlan).toHaveBeenCalledTimes(1)
  expect(datos.api.plan).toHaveBeenLastCalledWith(clienteId, "2026-11-02")
})
it("conserva el fallo de fuentes lentas hasta recuperarlas, sin marcar la copia como nueva", async () => {
  const datos = fuentes()
  datos.nutricion.vigente.mockRejectedValueOnce(new Error("sin dieta disponible"))
  await render(vista(datos))
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  await pasar(30000)
  expect(datos.nutricion.vigente).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  await pasar(30000)
  expect(datos.nutricion.vigente).toHaveBeenCalledTimes(2)
  expect(screen.queryByRole("alert")).toBeNull()
})
