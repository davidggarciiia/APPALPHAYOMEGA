import { fireEvent, render, screen, within } from "@testing-library/react-native"
import type { EjercicioPrescrito } from "@alpha-omega/shared"
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
