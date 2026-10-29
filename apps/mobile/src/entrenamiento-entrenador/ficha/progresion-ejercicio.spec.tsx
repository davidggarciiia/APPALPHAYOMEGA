import { fireEvent, render, screen, within } from "@testing-library/react-native"
import type { FichaDeUsuario, ListadoResultados, ProgresionFuerza } from "@alpha-omega/shared"
import { ErrorDePermiso } from "../../lib/http"
import { ProgresionEjercicio } from "./progresion-ejercicio"
import { ListaProgresion } from "./lista-progresion"

let mockFontScale = 1
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 1, fontScale: mockFontScale }),
}))
beforeEach(() => {
  mockFontScale = 1
})

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

function datos(cantidad = 5) {
  const resultados: ListadoResultados["resultados"] = Array.from({ length: cantidad }, (_, i) => {
    const fecha = `2026-10-${String(26 - i * 2).padStart(2, "0")}`
    return {
      agenda: {
        id: `sesion-${i}`,
        clienteId: "cliente",
        fechaActual: fecha,
        fechaOriginal: fecha,
        estado: "cerrada",
        revision: 0,
      },
      resultado: {
        sesionId: `sesion-${i}`,
        enviadoEn: `${fecha}T12:00:00Z`,
        revisionPrescripcion: 0,
        notas: null,
        prescripcion: {
          nombre: "Empuje",
          ejercicios: [
            {
              id: "prescrito",
              ejercicioId: "press",
              nombre: "Press inclinado",
              indicaciones: null,
              rir: { min: 2, max: 2 },
              tipoCarga: "conCargaExterna",
              series: ["a", "b", "c"].map((id) => ({
                id,
                tipoMedicion: "repeticiones",
                repeticiones: 8,
                repeticionesMax: 10,
                pesoKg: 60,
              })),
            },
          ],
        },
        series: [
          {
            serieId: "a",
            hecha: true,
            valores: {
              tipoMedicion: "repeticiones",
              pesoKg: 60 - i * 2.5,
              repeticiones: 10,
              rir: 2,
            },
          },
          {
            serieId: "b",
            hecha: true,
            valores: {
              tipoMedicion: "repeticiones",
              pesoKg: 60 - i * 2.5,
              repeticiones: 9,
              rir: 1,
            },
          },
          { serieId: "c", hecha: false, omitida: true },
        ],
      },
    }
  })
  const fuerza: ProgresionFuerza = {
    ejercicios: [
      {
        ejercicioId: "press",
        nombre: "Press inclinado",
        puntos: resultados
          .map(({ agenda, resultado }) => {
            const s = resultado.series[0]!
            if (!s.hecha || s.valores.tipoMedicion !== "repeticiones") throw new Error("Fixture")
            return {
              fecha: agenda.fechaActual,
              pesoKg: s.valores.pesoKg!,
              repeticiones: 10,
              estimado: (s.valores.pesoKg! * 4) / 3,
            }
          })
          .reverse(),
      },
    ],
  }
  return { resultados, fuerza }
}

function propiedades(cantidad = 5) {
  const d = datos(cantidad)
  return {
    clienteId: "cliente",
    ejercicioId: "press",
    api: { resultados: jest.fn(async () => ({ resultados: d.resultados })) },
    seguimiento: { fuerza: jest.fn(async () => d.fuerza) },
    leerFicha: jest.fn(async () => ({ nombre: "David", apellidos: "García" }) as FichaDeUsuario),
    volver: jest.fn(),
    ajustar: jest.fn(),
    abrirSesion: jest.fn(),
  }
}

it("muestra estado de E1, kg y Epley semanal, pedido y series; navega sin acciones de carga", async () => {
  const p = propiedades()
  await render(<ProgresionEjercicio {...p} />)
  expect(await screen.findByText("PRESS INCLINADO")).toBeOnTheScreen()
  expect(screen.getByText("David García")).toBeOnTheScreen()
  expect(screen.getByText("Progresa")).toBeOnTheScreen()
  expect(screen.getByText("60 kg × 10")).toBeOnTheScreen()
  expect(screen.getByText("80,0 kg")).toBeOnTheScreen()
  expect(
    screen.getByLabelText(/Press inclinado: mejor serie semanal y 1RM estimado/),
  ).toBeOnTheScreen()
  expect(screen.getAllByTestId("sesion-progresion")).toHaveLength(4)
  const sesion = screen.getAllByTestId("sesion-progresion")[0]!
  expect(within(sesion).getByText("Omitida")).toBeOnTheScreen()
  expect(within(sesion).getByText("RIR 1")).toHaveStyle({ color: "#F0B44C" })
  expect(screen.queryByText(/Sube carga la próxima vez|Sube a/)).toBeNull()
  expect(p.api.resultados).toHaveBeenCalledWith("cliente", 60)
  await fireEvent.press(screen.getByRole("button", { name: "Ajustar RIR pedido" }))
  expect(p.ajustar).toHaveBeenCalledWith("press")
  await fireEvent.press(sesion)
  expect(p.abrirSesion).toHaveBeenCalledWith("sesion-0", "David García")
  await fireEvent.press(screen.getByRole("button", { name: "Ver más sesiones" }))
  expect(screen.getAllByTestId("sesion-progresion")).toHaveLength(5)
})

it("con una sola semana muestra cifras sin gráfica y sin estado inventado", async () => {
  await render(<ProgresionEjercicio {...propiedades(1)} />)
  expect(await screen.findByText("60 kg × 10")).toBeOnTheScreen()
  expect(screen.queryByRole("image")).toBeNull()
  expect(screen.queryByText("Progresa")).toBeNull()
  expect(screen.getByText("Sin semana anterior")).toBeOnTheScreen()
})

// Sustituye «muestra $estado comparando las mejores series semanales».
it.each([
  { pesos: [60, 60, 60], estado: "Estancado" },
  { pesos: [55, 57.5, 60], estado: "Baja" },
])(
  "muestra $estado comparando tres sesiones aunque compartan semana",
  async ({ pesos, estado }) => {
    const p = propiedades(3)
    const d = datos(3)
    d.resultados.forEach(({ resultado }, i) =>
      resultado.series.forEach((s) => {
        if (s.hecha) s.valores.pesoKg = pesos[i]!
      }),
    )
    p.api.resultados.mockResolvedValue({ resultados: d.resultados })
    p.seguimiento.fuerza.mockResolvedValue({ ejercicios: [] })
    await render(<ProgresionEjercicio {...p} />)
    expect(await screen.findByText(estado)).toBeOnTheScreen()
  },
)

// Sustituye «no atribuye un estado semanal a dos sesiones de una misma primera semana».
it("observa progreso entre sesiones de una misma primera semana", async () => {
  const p = propiedades(2)
  const d = datos(2)
  d.resultados[1]!.agenda.fechaActual = "2026-10-26"
  d.resultados[0]!.agenda.fechaActual = "2026-10-27"
  p.api.resultados.mockResolvedValue({ resultados: d.resultados })
  p.seguimiento.fuerza.mockResolvedValue({ ejercicios: [] })
  await render(<ProgresionEjercicio {...p} />)
  expect(await screen.findByText("60 kg × 10")).toBeOnTheScreen()
  expect(screen.getByText("Progresa")).toBeOnTheScreen()
})

it.each([60, 62.5])(
  "con una sola igualdad o bajada desde %s no inventa tendencia",
  async (anterior) => {
    const p = propiedades(2)
    const d = datos(2)
    d.resultados[1]!.resultado.series.forEach((s) => {
      if (s.hecha) s.valores.pesoKg = anterior
    })
    p.api.resultados.mockResolvedValue({ resultados: d.resultados })
    p.seguimiento.fuerza.mockResolvedValue({ ejercicios: [] })
    await render(<ProgresionEjercicio {...p} />)
    await screen.findByText("60 kg × 10")
    expect(screen.queryByText("Estancado")).toBeNull()
    expect(screen.queryByText("Baja")).toBeNull()
  },
)

it("una sesión sin marca interrumpe la racha aunque fuerza tenga puntos válidos", async () => {
  const p = propiedades(3)
  const d = datos(3)
  d.resultados.forEach(({ resultado }) =>
    resultado.series.forEach((s) => {
      if (s.hecha) s.valores.pesoKg = 60
    }),
  )
  d.resultados[1]!.resultado.series = [{ serieId: "a", hecha: false, omitida: true }]
  p.api.resultados.mockResolvedValue({ resultados: d.resultados })
  await render(<ProgresionEjercicio {...p} />)
  await screen.findByText("60 kg × 10")
  expect(screen.queryByText("Estancado")).toBeNull()
  expect(screen.queryByText("Progresa")).toBeNull()
})

it("con texto grande reparte las series en dos columnas y comunica las cifras al lector", async () => {
  mockFontScale = 1.4
  await render(<ProgresionEjercicio {...propiedades(1)} />)
  const sesion = (await screen.findAllByTestId("sesion-progresion"))[0]!
  expect(sesion.props.accessibilityLabel).toContain("Serie 1, 60 × 10, RIR 2")
  expect(within(sesion).getByLabelText("Serie 1, 60 × 10, RIR 2")).toHaveStyle({ flexBasis: "45%" })
})

it("ofrece vacío, error y reintento conservando consultas de solo resultados enviados", async () => {
  const p = propiedades(0)
  p.api.resultados.mockRejectedValueOnce(new Error("sin conexión"))
  await render(<ProgresionEjercicio {...p} />)
  await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }))
  expect(await screen.findByText("Aún sin sesiones de este ejercicio.")).toBeOnTheScreen()
})

it("muestra esqueleto durante la carga", async () => {
  const p = propiedades()
  p.api.resultados.mockImplementation(() => new Promise(() => undefined))
  await render(<ProgresionEjercicio {...p} />)
  expect(screen.getByLabelText("Cargando progresión del ejercicio")).toBeOnTheScreen()
})

it("conserva la copia ante fallo de red y la retira si se revoca el permiso", async () => {
  const p = propiedades()
  await render(<ProgresionEjercicio {...p} />)
  await screen.findByText("60 kg × 10")
  const sinRed = {
    resultados: jest.fn(async () => {
      throw new Error("sin red")
    }),
  }
  await screen.rerender(<ProgresionEjercicio {...p} api={sinRed} />)
  await screen.findByText("No se pudo cargar la progresión del ejercicio.")
  expect(screen.getByText("60 kg × 10")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Ajustar RIR pedido" })).toBeNull()
  const sinPermiso = {
    resultados: jest.fn(async () => {
      throw new ErrorDePermiso("403")
    }),
  }
  await screen.rerender(<ProgresionEjercicio {...p} api={sinPermiso} />)
  await screen.findByText("No se pudo cargar la progresión del ejercicio.")
  expect(screen.queryByText("60 kg × 10")).toBeNull()
})

it.each(["tiempo", "distancia"] as const)(
  "conserva %s sin atribuirle 1RM ni doble progresión",
  async (tipo) => {
    const p = propiedades(1)
    const d = datos(1)
    const e = d.resultados[0]!.resultado.prescripcion.ejercicios[0]!
    e.tipoCarga = "sinCarga"
    e.rir = undefined
    e.series = [
      {
        id: "a",
        pesoKg: null,
        ...(tipo === "tiempo"
          ? { tipoMedicion: "tiempo", segundos: 30 }
          : { tipoMedicion: "distancia", metros: 20 }),
      },
    ]
    d.resultados[0]!.resultado.series = [
      {
        serieId: "a",
        hecha: true,
        valores: {
          pesoKg: null,
          ...(tipo === "tiempo"
            ? { tipoMedicion: "tiempo", segundos: 30 }
            : { tipoMedicion: "distancia", metros: 20 }),
        },
      },
    ]
    p.api.resultados.mockResolvedValue({ resultados: d.resultados })
    p.seguimiento.fuerza.mockResolvedValue({ ejercicios: [] })
    await render(<ProgresionEjercicio {...p} />)
    expect(await screen.findByText(tipo === "tiempo" ? "30 s" : "20 m")).toBeOnTheScreen()
    expect(screen.queryByText("1RM estimado")).toBeNull()
    expect(screen.queryByText("Doble progresión")).toBeNull()
    expect(screen.getByText("RIR —")).toBeOnTheScreen()
  },
)

it("la lista abre cada ejercicio con estado observado e incluye el historial sin kilos", async () => {
  const p = propiedades()
  const d = datos()
  const abrir = jest.fn()
  await render(
    <ListaProgresion ejercicios={d.fuerza.ejercicios} resultados={d.resultados} abrir={abrir} />,
  )
  await fireEvent.press(screen.getByRole("button", { name: /Press inclinado.*Progresa/ }))
  expect(abrir).toHaveBeenCalledWith("press")
  expect(screen.queryByText(/Sube carga/)).toBeNull()
  expect(p.api.resultados).not.toHaveBeenCalled()
})

it.each(["calentamiento", "circuito", "final"] as const)(
  "la lista y la progresión descartan ejercicios de %s aunque fuerza tenga una copia antigua",
  async (seccion) => {
    const p = propiedades(1)
    const d = datos(1)
    const e = d.resultados[0]!.resultado.prescripcion.ejercicios[0]!
    e.seccion = seccion
    p.api.resultados.mockResolvedValue({ resultados: d.resultados })
    await render(
      <ListaProgresion
        ejercicios={d.fuerza.ejercicios}
        resultados={d.resultados}
        abrir={jest.fn()}
      />,
    )
    expect(screen.queryByRole("button", { name: /Press inclinado/ })).toBeNull()
    expect(screen.getByText("Aún sin ejercicios con historial.")).toBeOnTheScreen()
    await screen.rerender(<ProgresionEjercicio {...p} />)
    expect(await screen.findByText("Aún sin sesiones de este ejercicio.")).toBeOnTheScreen()
    expect(screen.queryByText("60 kg × 10")).toBeNull()
    expect(screen.queryByText("1RM estimado")).toBeNull()
  },
)
