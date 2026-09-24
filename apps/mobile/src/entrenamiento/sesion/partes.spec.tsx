import { fireEvent, render, screen } from "@testing-library/react-native"
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
import { ListaMarcable, seriesMarcadas } from "./partes"

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

it("permite escribir los kilos antes de marcar un calentamiento con carga externa", async () => {
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
    disabled: true,
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

  it("con carga pide kg por serie y marca en metros con el peso escrito", async () => {
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
    // Sin kilos pautados en la segunda serie, no se puede marcar sin escribirlos.
    expect(casilla).toHaveProp("accessibilityState", { checked: false, disabled: true })
    expect(screen.getByLabelText("Peso — Paseo del granjero, serie 1")).toHaveProp(
      "placeholder",
      "16",
    )
    expect(screen.getByLabelText("Peso — Paseo del granjero, serie 2")).toHaveProp(
      "placeholder",
      "Escribe kg",
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
