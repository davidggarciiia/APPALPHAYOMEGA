import { fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { withTiming } from "react-native-reanimated"
import * as Haptics from "expo-haptics"
import {
  mantieneUnidadYCarga,
  PrescripcionSchema,
  SerieRegistradaDistanciaSchema,
  type EjercicioPrescrito,
} from "@alpha-omega/shared"
import {
  registroParaEnviar,
  registroSinValidar,
  type EjercicioConDistancia,
} from "../registro-modelo"
import { CabeceraSesion, Descanso, ListaMarcable, seriesMarcadas } from "./partes"

jest.mock("react-native-reanimated", () => {
  const base = jest.requireActual("react-native-reanimated/mock")
  return { ...base, withTiming: jest.fn(base.withTiming) }
})
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}))

afterEach(() => jest.restoreAllMocks())

it("centra el reloj y expone el recorrido sin repetir el nombre ni las cifras", async () => {
  await render(<CabeceraSesion nombre="Empuje" hechas={2} total={8} segundos={65} />)
  expect(
    screen.getByRole("timer", { name: "Tiempo de sesión: 1 minutos 5 segundos" }),
  ).toHaveTextContent("1:05")
  expect(screen.getByRole("progressbar", { name: "Progreso de la sesión" })).toHaveProp(
    "accessibilityValue",
    { min: 0, max: 8, now: 2 },
  )
  expect(screen.queryByText("Empuje")).toBeNull()
  expect(screen.queryByText(/series de la parte principal/)).toBeNull()
})

it("bloquea Terminar durante el envío y cuando la sesión está deshabilitada", async () => {
  const terminar = jest.fn()
  const props = { hechas: 2, total: 8, segundos: 65, terminar }
  const vista = await render(<CabeceraSesion {...props} ocupado />)
  const boton = screen.getByRole("button", { name: "Terminar" })
  expect(boton).toHaveProp("accessibilityState", { busy: true, disabled: true })
  await fireEvent.press(boton)
  expect(terminar).not.toHaveBeenCalled()
  await vista.rerender(<CabeceraSesion {...props} deshabilitado />)
  expect(screen.getByRole("button", { name: "Terminar" })).toBeDisabled()
  await vista.rerender(<CabeceraSesion {...props} />)
  await fireEvent.press(screen.getByRole("button", { name: "Terminar" }))
  expect(terminar).toHaveBeenCalledTimes(1)
})

it("permite restar o añadir quince segundos y saltar desde la franja", async () => {
  const ajustar = jest.fn()
  const saltar = jest.fn()
  await render(<Descanso restante={45} total={60} ajustar={ajustar} saltar={saltar} />)
  expect(screen.getByRole("timer", { name: "Quedan 45 segundos de descanso" })).toHaveTextContent(
    "0:45",
  )
  await fireEvent.press(screen.getByRole("button", { name: "Restar 15 segundos de descanso" }))
  await fireEvent.press(screen.getByRole("button", { name: "Añadir 15 segundos de descanso" }))
  await fireEvent.press(screen.getByRole("button", { name: "Saltar descanso" }))
  expect(ajustar.mock.calls).toEqual([[-15], [15]])
  expect(saltar).toHaveBeenCalledTimes(1)
})

it("con movimiento reducido avisa en los últimos tres segundos y al acabar sin repetir ni animar", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const props = { total: 60, ajustar: jest.fn(), saltar: jest.fn() }
  const vista = await render(<Descanso {...props} restante={4} />)
  jest.mocked(withTiming).mockClear()
  for (const restante of [3, 3, 2, 1, 0, 0])
    await vista.rerender(<Descanso {...props} restante={restante} />)
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3)
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning")
  expect(screen.queryByRole("timer")).toBeNull()
  expect(withTiming).not.toHaveBeenCalled()
})

it("la barra de descanso se vacía en el hilo de interfaz durante el tiempo restante", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  await render(<Descanso restante={45} total={60} ajustar={jest.fn()} saltar={jest.fn()} />)
  expect(withTiming).toHaveBeenCalledWith(0, expect.objectContaining({ duration: 45000 }))
})

it("puede suspender el movimiento del descanso sin detener el reloj ni su háptica", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const props = { total: 60, ajustar: jest.fn(), saltar: jest.fn(), animar: false }
  const vista = await render(<Descanso {...props} restante={4} />)
  jest.mocked(withTiming).mockClear()
  for (const restante of [3, 2, 1, 0])
    await vista.rerender(<Descanso {...props} restante={restante} />)
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning")
  expect(withTiming).not.toHaveBeenCalled()
})

const serieId = "10000000-0000-4000-8000-000000000001"
const ejercicio: EjercicioPrescrito = {
  id: "10000000-0000-4000-8000-000000000002",
  ejercicioId: "10000000-0000-4000-8000-000000000003",
  nombre: "Movilidad",
  indicaciones: null,
  seccion: "calentamiento",
  tipoCarga: "conCargaExterna",
  series: [{ id: serieId, tipoMedicion: "repeticiones", repeticiones: 10, pesoKg: null }],
}

it.each(["calentamiento", "final"] as const)(
  "D13: permite marcar %s con carga externa sin escribir kilos",
  async (seccion) => {
    const marcar = jest.fn()
    const pauta = { ...ejercicio, seccion }
    await render(
      <ListaMarcable
        titulo={seccion === "calentamiento" ? "Calentamiento" : "Final"}
        ejercicios={[pauta]}
        series={[{ serieId, peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        marcar={marcar}
        cambiarPeso={jest.fn()}
      />,
    )
    const casilla = screen.getByRole("checkbox", { name: /Movilidad/ })
    expect(casilla).toBeEnabled()
    await fireEvent.press(casilla)
    expect(marcar).toHaveBeenCalledWith(pauta, true)
    expect(screen.queryByText("Escribe el peso usado antes de marcar el ejercicio.")).toBeNull()
    expect(screen.getByLabelText("Peso — Movilidad, serie 1")).toHaveProp(
      "keyboardType",
      "decimal-pad",
    )
  },
)

it("permite anotar kilos opcionales antes de marcar un calentamiento con carga externa", async () => {
  const cambiarPeso = jest.fn()
  const marcar = jest.fn()
  const props = {
    titulo: "Calentamiento",
    ejercicios: [ejercicio],
    series: [{ serieId, peso: "", valor: "", hecha: false }],
    bloqueado: false,
    marcar,
    cambiarPeso,
  }
  const vista = await render(<ListaMarcable {...props} />)
  expect(screen.getByRole("checkbox", { name: /Movilidad/ })).toHaveProp("accessibilityState", {
    checked: false,
    disabled: false,
  })
  await fireEvent.changeText(screen.getByLabelText("Peso — Movilidad, serie 1"), "12,5")
  expect(cambiarPeso).toHaveBeenCalledWith(serieId, "12,5")
  await vista.rerender(
    <ListaMarcable {...props} series={[{ serieId, peso: "12,5", valor: "", hecha: false }]} />,
  )
  await fireEvent.press(screen.getByRole("checkbox", { name: /Movilidad/ }))
  expect(marcar).toHaveBeenCalledWith(ejercicio, true)
  const prescripcion = PrescripcionSchema.parse({ nombre: "Empuje", ejercicios: [ejercicio] })
  expect(
    registroParaEnviar(prescripcion, {
      notas: "",
      series: [{ serieId, peso: "12,5", valor: "10", hecha: true }],
    }).series[0],
  ).toMatchObject({ hecha: true, pesoKg: 12.5, repeticiones: 10 })
})

it("muestra el peso prescrito de una sesión antigua y oculta kg si no hay carga", async () => {
  const props = {
    titulo: "Final",
    ejercicios: [
      {
        ...ejercicio,
        tipoCarga: undefined,
        seccion: "final" as const,
        series: [
          { id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 10, pesoKg: 8 },
        ],
      },
    ],
    series: [{ serieId, peso: "", valor: "", hecha: false }],
    bloqueado: false,
    marcar: jest.fn(),
    cambiarPeso: jest.fn(),
  }
  const vista = await render(<ListaMarcable {...props} />)
  expect(screen.getByLabelText("Peso — Movilidad, serie 1")).toHaveProp("placeholder", "8")
  await vista.rerender(
    <ListaMarcable {...props} ejercicios={[{ ...ejercicio, tipoCarga: "sinCarga" as const }]} />,
  )
  expect(screen.queryByLabelText("Peso — Movilidad, serie 1")).toBeNull()
})

it("marcar da por hechas las series con lo prescrito y desmarcar conserva lo escrito", () => {
  const segunda = "10000000-0000-4000-8000-000000000004"
  const conDos: EjercicioPrescrito = {
    ...ejercicio,
    series: [
      { id: serieId, tipoMedicion: "repeticiones", repeticiones: 10, pesoKg: 8 },
      { id: segunda, tipoMedicion: "tiempo", segundos: 30, pesoKg: null },
    ],
  }
  const otra = {
    serieId: "10000000-0000-4000-8000-000000000005",
    peso: "",
    valor: "",
    hecha: false,
  }
  const marcadas = seriesMarcadas(
    conDos,
    [
      { serieId, peso: "", valor: "12", hecha: false, omitida: true },
      { serieId: segunda, peso: "", valor: "", hecha: false },
      otra,
    ],
    true,
  )
  expect(marcadas).toEqual([
    { serieId, peso: "8", valor: "12", hecha: true },
    { serieId: segunda, peso: "", valor: "30", hecha: true },
    otra,
  ])
  expect(seriesMarcadas(conDos, marcadas, false)).toEqual([
    { serieId, peso: "8", valor: "12", hecha: false },
    { serieId: segunda, peso: "", valor: "30", hecha: false },
    otra,
  ])
})

describe("Distancia en metros (D01, aún sin publicar)", () => {
  const u = (n: number): string => `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const transporte: EjercicioConDistancia = {
    id: u(1),
    ejercicioId: u(101),
    nombre: "Paseo del granjero",
    indicaciones: null,
    seccion: "calentamiento",
    tipoCarga: "conCargaExterna",
    series: [
      { id: u(11), tipoMedicion: "distancia", pesoKg: 16, metros: 20 },
      { id: u(12), tipoMedicion: "distancia", pesoKg: null, metros: 20 },
    ],
  }
  const valida = (e: EjercicioConDistancia, series: ReturnType<typeof seriesMarcadas>): void => {
    const registro = registroSinValidar(
      { nombre: "Calentamiento", ejercicios: [e] },
      {
        notas: "",
        series,
      },
    )
    for (const [n, serie] of registro.series.entries()) {
      expect(SerieRegistradaDistanciaSchema.safeParse(serie).success).toBe(true)
      expect(mantieneUnidadYCarga(serie, e.series[n]!, e.tipoCarga)).toBe(true)
      expect(serie).not.toHaveProperty("repeticiones")
      expect(serie).not.toHaveProperty("segundos")
    }
  }

  it("con carga permite anotar kg opcionales por serie y conserva los metros", async () => {
    const marcar = jest.fn()
    const props = {
      titulo: "Calentamiento",
      ejercicios: [transporte],
      series: [
        { serieId: u(11), peso: "", valor: "", hecha: false },
        { serieId: u(12), peso: "", valor: "", hecha: false },
      ],
      bloqueado: false,
      marcar,
      cambiarPeso: jest.fn(),
    }
    const vista = await render(<ListaMarcable {...props} />)
    const casilla = screen.getByRole("checkbox", { name: "Paseo del granjero, 2 × 20 m" })
    expect(casilla).toHaveProp("accessibilityState", { checked: false, disabled: false })
    expect(screen.getByLabelText("Peso — Paseo del granjero, serie 1")).toHaveProp(
      "placeholder",
      "16",
    )
    expect(screen.getByLabelText("Peso — Paseo del granjero, serie 2")).toHaveProp(
      "placeholder",
      "Opcional",
    )

    const conPeso = [props.series[0]!, { ...props.series[1]!, peso: "18" }]
    await vista.rerender(<ListaMarcable {...props} series={conPeso} />)
    await fireEvent.press(screen.getByRole("checkbox", { name: "Paseo del granjero, 2 × 20 m" }))
    expect(marcar).toHaveBeenCalledWith(transporte, true)

    const marcadas = seriesMarcadas(transporte, conPeso, true)
    expect(marcadas).toEqual([
      { serieId: u(11), peso: "16", valor: "20", hecha: true },
      { serieId: u(12), peso: "18", valor: "20", hecha: true },
    ])
    valida(transporte, marcadas)
  })

  it("sin carga no pide kg y marca los metros pautados", async () => {
    const zancadas: EjercicioConDistancia = {
      ...transporte,
      nombre: "Zancadas caminando",
      tipoCarga: "sinCarga",
      series: [{ id: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 30 }],
    }
    const series = [{ serieId: u(21), peso: "", valor: "", hecha: false }]
    await render(
      <ListaMarcable
        titulo="Final"
        ejercicios={[zancadas]}
        series={series}
        bloqueado={false}
        marcar={jest.fn()}
        cambiarPeso={jest.fn()}
      />,
    )
    expect(screen.queryByLabelText(/Peso —/)).toBeNull()
    expect(screen.getByRole("checkbox", { name: "Zancadas caminando, 1 × 30 m" })).toHaveProp(
      "accessibilityState",
      { checked: false, disabled: false },
    )

    const marcadas = seriesMarcadas(zancadas, series, true)
    expect(marcadas).toEqual([{ serieId: u(21), peso: "", valor: "30", hecha: true }])
    valida(zancadas, marcadas)
  })
})
