import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react-native"
import {
  mantieneUnidadYCarga,
  SerieRegistradaDistanciaSchema,
  type EjercicioPrescrito,
} from "@alpha-omega/shared"
import {
  registroSinValidar,
  type EdicionRegistro,
  type EjercicioConDistancia,
  type PrescripcionConDistancia,
} from "./registro-modelo"
import { PrescripcionVisible, type ResultadoConDistancia } from "./resultado"
import { TablaSeries } from "./tabla-series"

const id = "10000000-0000-4000-8000-000000000000"
const serieId = "20000000-0000-4000-8000-000000000000"
const ejercicio: EjercicioPrescrito = {
  id,
  ejercicioId: "30000000-0000-4000-8000-000000000000",
  nombre: "Plancha",
  indicaciones: null,
  tipoCarga: "sinCarga",
  modoRir: "desactivado",
  series: [{ id: serieId, tipoMedicion: "tiempo", segundos: 30, pesoKg: null }],
}

it("el ejercicio sin carga y por tiempo muestra segundos, omitir y una marca de un toque", async () => {
  const cambiar = jest.fn()
  await render(
    <TablaSeries
      ejercicio={ejercicio}
      series={[{ serieId, peso: "", valor: "", hecha: false }]}
      bloqueado={false}
      cambiar={cambiar}
      enCurso={serieId}
    />,
  )
  expect(screen.queryByLabelText(/Peso —/)).toBeNull()
  expect(screen.getByLabelText(/Segundos —/)).toBeTruthy()
  expect(screen.queryByText("¿Cuántas te quedaban?")).toBeNull()
  await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
  expect(cambiar).toHaveBeenCalledWith(
    serieId,
    expect.objectContaining({ hecha: true, valor: "30" }),
  )
  await fireEvent.press(screen.getByRole("button", { name: /Omitir serie/ }))
  expect(cambiar).toHaveBeenCalledWith(serieId, { hecha: false, omitida: true })
})

it("RIR se pide en cada serie solo cuando el entrenador lo configuró", async () => {
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    tipoCarga: "conCargaExterna" as const,
    series: [{ id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 }],
  }
  await render(
    <TablaSeries
      ejercicio={conRir}
      series={[{ serieId, peso: "", valor: "", hecha: false }]}
      bloqueado={false}
      cambiar={jest.fn()}
      enCurso={serieId}
    />,
  )
  expect(screen.getByLabelText(/Peso —/)).toBeTruthy()
  expect(screen.getByText("¿Cuántas te quedaban?")).toBeTruthy()
})

it("una serie hecha permite corregir el RIR o dejarlo sin anotar sin tocar lo demás", async () => {
  const segunda = "20000000-0000-4000-8000-000000000001"
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    tipoCarga: "conCargaExterna" as const,
    rir: { min: 2, max: 2 },
    series: [
      { id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 },
      { id: segunda, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: 20 },
    ],
  }
  const cambiar = jest.fn()
  await render(
    <TablaSeries
      ejercicio={conRir}
      series={[
        { serieId, peso: "20", valor: "8", hecha: true, rir: 1 },
        { serieId: segunda, peso: "", valor: "", hecha: false },
      ]}
      bloqueado={false}
      cambiar={cambiar}
      enCurso={segunda}
    />,
  )
  expect(screen.queryByLabelText("Repeticiones que te quedaban, serie 1")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: /RIR, serie 1: 1/ }))
  const pregunta = screen.getByLabelText("Repeticiones que te quedaban, serie 1")
  await fireEvent.press(within(pregunta).getByRole("radio", { name: "3" }))
  expect(cambiar).toHaveBeenLastCalledWith(serieId, { rir: 3 })
  expect(screen.queryByLabelText("Repeticiones que te quedaban, serie 1")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: /RIR, serie 1: 1/ }))
  await fireEvent.press(screen.getByRole("button", { name: "Sin anotar el RIR de la serie 1" }))
  expect(cambiar).toHaveBeenLastCalledWith(serieId, { rir: null })
})

it("con el registro bloqueado el RIR de una serie hecha no se puede corregir", async () => {
  const conRir = {
    ...ejercicio,
    modoRir: "cadaSerie" as const,
    series: [{ id: serieId, tipoMedicion: "repeticiones" as const, repeticiones: 8, pesoKg: null }],
  }
  await render(
    <TablaSeries
      ejercicio={conRir}
      series={[{ serieId, peso: "", valor: "8", hecha: true, rir: 2 }]}
      bloqueado
      cambiar={jest.fn()}
    />,
  )
  await fireEvent.press(screen.getByLabelText(/RIR, serie 1: 2/))
  expect(screen.queryByLabelText("Repeticiones que te quedaban, serie 1")).toBeNull()
})

it("pregunta el RIR opcional al resolver el ejercicio completo", async () => {
  const cambiar = jest.fn()
  await render(
    <TablaSeries
      ejercicio={{ ...ejercicio, modoRir: "alFinalizarEjercicio", rir: { min: 2, max: 2 } }}
      series={[{ serieId, peso: "", valor: "30", hecha: true }]}
      bloqueado={false}
      cambiar={cambiar}
    />,
  )
  expect(screen.getByText(/Al terminar este ejercicio/)).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("radio", { name: "2" }))
  expect(cambiar).toHaveBeenCalledWith(serieId, { rir: 2 })
})

describe("Distancia en metros (D01, aún sin publicar)", () => {
  const u = (n: number): string => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const transporte: EjercicioConDistancia = {
    id: u(1),
    ejercicioId: u(101),
    nombre: "Paseo del granjero",
    indicaciones: null,
    tipoCarga: "conCargaExterna",
    modoRir: "desactivado",
    series: [
      { id: u(11), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
      { id: u(12), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
    ],
  }
  const zancadas: EjercicioConDistancia = {
    id: u(2),
    ejercicioId: u(102),
    nombre: "Zancadas caminando",
    indicaciones: null,
    tipoCarga: "sinCarga",
    modoRir: "desactivado",
    series: [{ id: u(21), tipoMedicion: "distancia", pesoKg: null, metros: 30 }],
  }
  const vacias = (e: EjercicioConDistancia): EdicionRegistro["series"] =>
    e.series.map((s) => ({ serieId: s.id, peso: "", valor: "", hecha: false }))

  it("con carga pide kg y metros, sugiere lo pautado y marca en metros", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={transporte}
        series={vacias(transporte)}
        bloqueado={false}
        cambiar={cambiar}
        enCurso={u(11)}
        anterior={{ tipoMedicion: "distancia", pesoKg: 30, metros: 18 }}
      />,
    )
    expect(screen.getByText("2 × 20 m")).toBeOnTheScreen()
    expect(screen.getByText("Kg")).toBeOnTheScreen()
    expect(screen.getByText("Metros")).toBeOnTheScreen()
    expect(screen.getByText("Anterior 30 kg × 18 m")).toBeOnTheScreen()
    expect(screen.getByLabelText("Serie 1, serie en curso: 20 m · 32 kg")).toBeOnTheScreen()
    const metros = screen.getByLabelText("Metros — Paseo del granjero, serie 1")
    expect(metros).toHaveProp("placeholder", "20")
    expect(metros).toHaveProp("accessibilityHint", "Sugerencia de tu entrenador: 32 kg, 20 metros.")
    expect(screen.queryByLabelText(/Repeticiones —|Segundos —/)).toBeNull()

    await fireEvent.changeText(metros, "25")
    expect(cambiar).toHaveBeenLastCalledWith(u(11), { valor: "25" })
    // Con el campo aún vacío (las series no cambian aquí), «Hecha» toma lo pautado.
    await fireEvent.press(
      screen.getByRole("checkbox", { name: "Hecha — Paseo del granjero, serie 1" }),
    )
    expect(cambiar).toHaveBeenLastCalledWith(u(11), {
      hecha: true,
      omitida: undefined,
      valor: "20",
      peso: "32",
    })
  })

  it("sin carga no pide kg; marcar y omitir conservan los metros", async () => {
    const cambiar = jest.fn()
    await render(
      <TablaSeries
        ejercicio={zancadas}
        series={vacias(zancadas)}
        bloqueado={false}
        cambiar={cambiar}
        enCurso={u(21)}
        anterior={{ tipoMedicion: "distancia", pesoKg: null, metros: 30 }}
      />,
    )
    expect(screen.queryByLabelText(/Peso —/)).toBeNull()
    expect(screen.queryByText("Kg")).toBeNull()
    expect(screen.getByText("Anterior 30 m")).toBeOnTheScreen()
    expect(screen.getByLabelText("Metros — Zancadas caminando, serie 1")).toHaveProp(
      "accessibilityHint",
      "Sugerencia de tu entrenador: 30 metros.",
    )
    await fireEvent.press(screen.getByRole("checkbox", { name: /Hecha —/ }))
    expect(cambiar).toHaveBeenLastCalledWith(u(21), {
      hecha: true,
      omitida: undefined,
      valor: "30",
    })
    await fireEvent.press(screen.getByRole("button", { name: /Omitir serie 1/ }))
    expect(cambiar).toHaveBeenLastCalledWith(u(21), { hecha: false, omitida: true })
  })

  it("un valor no válido no pasa; corregido, queda en metros sin repeticiones", async () => {
    const prescripcion: PrescripcionConDistancia = {
      nombre: "Transportes",
      ejercicios: [transporte],
    }
    let series = vacias(transporte)
    function Tabla(): React.JSX.Element {
      const [actuales, setActuales] = useState(series)
      return (
        <TablaSeries
          ejercicio={transporte}
          series={actuales}
          bloqueado={false}
          enCurso={u(11)}
          cambiar={(id, cambio) => {
            series = series.map((s) => (s.serieId === id ? { ...s, ...cambio } : s))
            setActuales(series)
          }}
        />
      )
    }
    const primera = (): { serie: unknown; valida: boolean } => {
      const serie = registroSinValidar(prescripcion, { notas: "", series }).series[0]!
      return {
        serie,
        valida:
          SerieRegistradaDistanciaSchema.safeParse(serie).success &&
          mantieneUnidadYCarga(serie, transporte.series[0]!, transporte.tipoCarga),
      }
    }
    await render(<Tabla />)
    const campo = (): ReturnType<typeof screen.getByLabelText> =>
      screen.getByLabelText("Metros — Paseo del granjero, serie 1")
    const hecha = (): ReturnType<typeof screen.getByRole> =>
      screen.getByRole("checkbox", { name: "Hecha — Paseo del granjero, serie 1" })

    // Los metros son enteros, igual que repeticiones y segundos.
    await fireEvent.changeText(campo(), "20,5")
    await fireEvent.press(hecha())
    expect(primera().valida).toBe(false)

    await fireEvent.changeText(campo(), "18")
    expect(primera()).toEqual({
      serie: { serieId: u(11), tipoMedicion: "distancia", pesoKg: 32, metros: 18, hecha: true },
      valida: true,
    })

    // Desmarcar no borra lo escrito ni lo pasa a otra unidad.
    await fireEvent.press(hecha())
    expect(series[0]).toEqual({ serieId: u(11), peso: "32", valor: "18", hecha: false })
    expect(registroSinValidar(prescripcion, { notas: "", series }).series[0]).toEqual({
      serieId: u(11),
      tipoMedicion: "distancia",
      pesoKg: 32,
      metros: 18,
      hecha: false,
    })
  })

  it("las series existentes conservan su presentación y la cabecera nombra cada unidad", async () => {
    const remo: EjercicioPrescrito = {
      ...ejercicio,
      nombre: "Remo",
      tipoCarga: "conCargaExterna",
      series: [
        {
          id: u(31),
          tipoMedicion: "repeticiones",
          repeticiones: 8,
          repeticionesMax: 10,
          pesoKg: 60,
        },
        { id: u(32), tipoMedicion: "tiempo", segundos: 30, pesoKg: 60 },
      ],
    }
    const vista = await render(
      <TablaSeries
        ejercicio={remo}
        series={[
          { serieId: u(31), peso: "", valor: "", hecha: false },
          { serieId: u(32), peso: "", valor: "", hecha: false },
        ]}
        bloqueado={false}
        cambiar={jest.fn()}
        enCurso={u(31)}
        anterior={{ tipoMedicion: "repeticiones", pesoKg: 55, repeticiones: 6 }}
      />,
    )
    expect(screen.getByText("Reps / s")).toBeOnTheScreen()
    expect(screen.getByText("Anterior 55 kg × 6")).toBeOnTheScreen()
    expect(screen.getByLabelText("Serie 1, serie en curso: 8 rep · 60 kg")).toBeOnTheScreen()
    expect(screen.getByLabelText("Serie 2: 30 s · 60 kg")).toBeOnTheScreen()
    expect(screen.getByLabelText("Repeticiones — Remo, serie 1")).toHaveProp(
      "accessibilityHint",
      "Sugerencia de tu entrenador: 60 kg, 8 repeticiones.",
    )
    expect(screen.getByLabelText("Segundos — Remo, serie 2")).toHaveProp("placeholder", "30")

    await vista.rerender(
      <TablaSeries
        ejercicio={{ ...remo, series: [remo.series[0]!] }}
        series={[{ serieId: u(31), peso: "", valor: "", hecha: false }]}
        bloqueado={false}
        cambiar={jest.fn()}
        anterior={{ tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 6 }}
      />,
    )
    expect(screen.getByText("Reps")).toBeOnTheScreen()
    expect(screen.getByText("Anterior 6 reps")).toBeOnTheScreen()

    await vista.rerender(
      <TablaSeries
        ejercicio={{ ...transporte, series: [remo.series[0]!, transporte.series[0]!] }}
        series={[
          { serieId: u(31), peso: "", valor: "", hecha: false },
          { serieId: u(11), peso: "", valor: "", hecha: false },
        ]}
        bloqueado={false}
        cambiar={jest.fn()}
      />,
    )
    expect(screen.getByText("Reps / m")).toBeOnTheScreen()
    expect(screen.getByLabelText("Repeticiones — Paseo del granjero, serie 1")).toBeOnTheScreen()
    expect(screen.getByLabelText("Metros — Paseo del granjero, serie 2")).toBeOnTheScreen()
  })

  // resultado.tsx no tiene prueba propia: su resumen se comprueba aquí, junto a la tabla.
  it("el resumen enviado muestra objetivo y hecho en metros; el resto, igual", async () => {
    const prescripcion: PrescripcionConDistancia = {
      nombre: "Transportes",
      ejercicios: [transporte, zancadas, ejercicio],
    }
    const resultado: ResultadoConDistancia = {
      sesionId: u(90),
      prescripcion,
      revisionPrescripcion: 1,
      enviadoEn: "2026-09-24T10:00:00.000Z",
      notas: null,
      series: [
        {
          serieId: u(11),
          hecha: true,
          valores: { tipoMedicion: "distancia", pesoKg: 32, metros: 18 },
        },
        { serieId: u(12), hecha: false, omitida: true },
        {
          serieId: u(21),
          hecha: true,
          valores: { tipoMedicion: "distancia", pesoKg: null, metros: 30 },
        },
        { serieId, hecha: true, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 } },
      ],
    }
    await render(<PrescripcionVisible prescripcion={prescripcion} resultado={resultado} />)
    expect(screen.getByText("3/4")).toBeOnTheScreen()
    expect(screen.getByText("Serie 1 · Objetivo: 20 m · 32 kg")).toBeOnTheScreen()
    expect(screen.getByText("Serie 2 · Objetivo: 20 m · 32 kg")).toBeOnTheScreen()
    expect(screen.getByText("Hecho: 18 m · 32 kg")).toBeOnTheScreen()
    expect(screen.getByText("Omitida")).toBeOnTheScreen()
    expect(screen.getByText("Serie 1 · Objetivo: 30 m")).toBeOnTheScreen()
    expect(screen.getByText("Hecho: 30 m")).toBeOnTheScreen()
    expect(screen.getByText("Serie 1 · Objetivo: 30 s")).toBeOnTheScreen()
    expect(screen.getByText("Hecho: 30 s")).toBeOnTheScreen()
  })
})
