import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { DefinicionCorporal } from "@alpha-omega/shared"

import { BloquePliegues } from "./pliegues-valoracion"
import { CAMPO_CORPORAL_VACIO, type CampoCorporal, type CampoGrasa } from "./valoracion-modelo"

// Puntos y valores sintéticos: no corresponden a ningún protocolo real.
const puntoA: DefinicionCorporal = {
  id: "40000000-0000-4000-8000-0000000000a1",
  version: 1,
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Punto A",
  unidad: "mm",
  zona: "Zona 1",
  lateralidad: "derecha",
  instrumento: "Plicómetro de prueba",
  protocolo: "Protocolo de prueba",
  activa: true,
}
const puntoB: DefinicionCorporal = {
  ...puntoA,
  id: "40000000-0000-4000-8000-0000000000b2",
  nombre: "Punto B",
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
}
const A = "Punto A, Zona 1, derecha"
const B = "Punto B"
const GRASA_VACIA: CampoGrasa = { texto: "", metodo: "", fecha: "" }

const cambiarCampo = jest.fn<void, [string, Partial<CampoCorporal>]>()
const cambiarGrasa = jest.fn<void, [CampoGrasa]>()

/** El editor real guarda el estado; aquí lo imita para probar recorridos completos. */
function Arnes({
  definiciones = [puntoA, puntoB],
  inicial = {},
  grasaInicial = GRASA_VACIA,
  bloqueado = false,
  fechaNacimiento,
  fechaToma = "2026-09-24",
}: {
  definiciones?: DefinicionCorporal[]
  inicial?: Record<string, Partial<CampoCorporal>>
  grasaInicial?: CampoGrasa
  bloqueado?: boolean
  fechaNacimiento?: string | null
  fechaToma?: string
}): React.JSX.Element {
  const [campos, setCampos] = useState<Record<string, CampoCorporal>>(() =>
    Object.fromEntries(
      Object.entries(inicial).map(([id, c]) => [id, { ...CAMPO_CORPORAL_VACIO, ...c }]),
    ),
  )
  const [grasa, setGrasa] = useState(grasaInicial)
  return (
    <BloquePliegues
      definiciones={definiciones}
      campos={campos}
      grasa={grasa}
      bloqueado={bloqueado}
      fechaNacimiento={fechaNacimiento}
      fechaToma={fechaToma}
      cambiarCampo={(id, cambio) => {
        cambiarCampo(id, cambio)
        setCampos((a) => ({ ...a, [id]: { ...CAMPO_CORPORAL_VACIO, ...a[id], ...cambio } }))
      }}
      cambiarGrasa={(nueva) => {
        cambiarGrasa(nueva)
        setGrasa(nueva)
      }}
    />
  )
}

it("muestra cada punto con su zona, lateralidad, instrumento, protocolo y unidad", async () => {
  await render(<Arnes />)
  expect(screen.getByText("Punto A · Zona 1 · derecha")).toBeTruthy()
  expect(screen.getByText("Unidad: mm · Instrumento: Plicómetro de prueba")).toBeTruthy()
  expect(screen.getByText("Protocolo: Protocolo de prueba")).toBeTruthy()
  expect(screen.getByText("Punto B")).toBeTruthy()
  expect(screen.getByText("Unidad: mm")).toBeTruthy()
  expect(screen.getByLabelText(`Valor adoptado (mm) — ${A}`)).toHaveProp(
    "keyboardType",
    "decimal-pad",
  )
})

it("escribe dos lecturas y adopta exactamente la elegida, sin calcular nada", async () => {
  await render(<Arnes />)
  await fireEvent.press(screen.getByRole("button", { name: `Añadir lectura — ${A}` }))
  const primera = screen.getByLabelText(`Lectura 1 (mm) — ${A}`)
  expect(primera).toHaveProp("keyboardType", "decimal-pad")
  await fireEvent.changeText(primera, "12,4")
  await fireEvent.press(screen.getByRole("button", { name: `Añadir lectura — ${A}` }))
  await fireEvent.changeText(screen.getByLabelText(`Lectura 2 (mm) — ${A}`), "12,6")

  expect(cambiarCampo.mock.calls).toEqual([
    [puntoA.id, { lecturas: [""] }],
    [puntoA.id, { lecturas: ["12,4"] }],
    [puntoA.id, { lecturas: ["12,4", ""] }],
    [puntoA.id, { lecturas: ["12,4", "12,6"] }],
  ])
  // Con dos lecturas el valor adoptado sigue vacío: nada lo rellena por su cuenta.
  expect(screen.getByLabelText(`Valor adoptado (mm) — ${A}`)).toHaveProp("value", "")
  expect(screen.queryByText(/12,5/)).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: `Adoptar lectura 2 — ${A}` }))
  expect(cambiarCampo).toHaveBeenLastCalledWith(puntoA.id, { texto: "12,6" })
  expect(cambiarCampo).toHaveBeenCalledTimes(5)
  expect(screen.getByLabelText(`Valor adoptado (mm) — ${A}`)).toHaveProp("value", "12,6")
})

it("conserva las lecturas con el valor adoptado vacío y deja escribirlo a mano", async () => {
  await render(<Arnes inicial={{ [puntoA.id]: { lecturas: ["10,2", "10,8"] } }} />)
  expect(screen.getByLabelText(`Lectura 1 (mm) — ${A}`)).toHaveProp("value", "10,2")
  expect(screen.getByLabelText(`Lectura 2 (mm) — ${A}`)).toHaveProp("value", "10,8")
  const adoptado = screen.getByLabelText(`Valor adoptado (mm) — ${A}`)
  expect(adoptado).toHaveProp("value", "")
  expect(screen.queryByText(/10,5/)).toBeNull()

  await fireEvent.changeText(adoptado, "10,6")
  expect(cambiarCampo.mock.calls).toEqual([[puntoA.id, { texto: "10,6" }]])
})

it("no deja adoptar una lectura vacía", async () => {
  await render(<Arnes inicial={{ [puntoA.id]: { lecturas: [""] } }} />)
  expect(screen.getByRole("button", { name: `Adoptar lectura 1 — ${A}` })).toBeDisabled()
})

it("admite como máximo cinco lecturas por punto", async () => {
  await render(<Arnes inicial={{ [puntoA.id]: { lecturas: ["10", "10,1", "10,2", "10,3"] } }} />)
  const anadir = screen.getByRole("button", { name: `Añadir lectura — ${A}` })
  expect(anadir).not.toBeDisabled()
  await fireEvent.press(anadir)
  expect(cambiarCampo).toHaveBeenLastCalledWith(puntoA.id, {
    lecturas: ["10", "10,1", "10,2", "10,3", ""],
  })
  expect(screen.getByLabelText(`Lectura 5 (mm) — ${A}`)).toBeTruthy()
  expect(screen.getByRole("button", { name: `Añadir lectura — ${A}` })).toBeDisabled()
  expect(screen.getByText("Máximo 5 lecturas por punto.")).toBeTruthy()

  await fireEvent.press(screen.getByRole("button", { name: `Añadir lectura — ${A}` }))
  expect(cambiarCampo).toHaveBeenCalledTimes(1)
  expect(screen.queryByLabelText(`Lectura 6 (mm) — ${A}`)).toBeNull()
})

it("quita una lectura y mantiene las demás en su orden", async () => {
  await render(
    <Arnes inicial={{ [puntoA.id]: { lecturas: ["10,2", "10,8", "11"], texto: "10,8" } }} />,
  )
  await fireEvent.press(screen.getByRole("button", { name: `Quitar lectura 2 — ${A}` }))
  expect(cambiarCampo.mock.calls).toEqual([[puntoA.id, { lecturas: ["10,2", "11"] }]])
  expect(screen.getByLabelText(`Lectura 2 (mm) — ${A}`)).toHaveProp("value", "11")
  expect(screen.queryByLabelText(`Lectura 3 (mm) — ${A}`)).toBeNull()
  // El valor adoptado es del profesional: quitar una lectura no lo toca.
  expect(screen.getByLabelText(`Valor adoptado (mm) — ${A}`)).toHaveProp("value", "10,8")
})

it("no realizado con motivo desactiva los valores sin borrar las lecturas", async () => {
  await render(<Arnes inicial={{ [puntoA.id]: { lecturas: ["10,2"], texto: "10,2" } }} />)
  const marca = screen.getByRole("checkbox", { name: `No realizado — ${A}` })
  expect(marca).toHaveProp("accessibilityState", { checked: false, disabled: false })
  await fireEvent.press(marca)
  expect(cambiarCampo).toHaveBeenLastCalledWith(puntoA.id, { noRealizado: true })
  expect(screen.getByRole("checkbox", { name: `No realizado — ${A}` })).toHaveProp(
    "accessibilityState",
    { checked: true, disabled: false },
  )

  expect(screen.getByLabelText(`Valor adoptado (mm) — ${A}`)).toBeDisabled()
  const lectura = screen.getByLabelText(`Lectura 1 (mm) — ${A}`)
  expect(lectura).toBeDisabled()
  expect(lectura).toHaveProp("value", "10,2")
  expect(screen.getByRole("button", { name: `Añadir lectura — ${A}` })).toBeDisabled()
  expect(screen.getByRole("button", { name: `Adoptar lectura 1 — ${A}` })).toBeDisabled()
  expect(screen.getByRole("button", { name: `Quitar lectura 1 — ${A}` })).not.toBeDisabled()
  expect(screen.getByText(/las lecturas no se guardan/)).toBeTruthy()
  // El otro punto sigue editable.
  expect(screen.getByLabelText(`Valor adoptado (mm) — ${B}`)).not.toBeDisabled()

  await fireEvent.changeText(
    screen.getByLabelText(`Motivo (opcional) — ${A}`),
    "Motivo sintético de prueba",
  )
  expect(cambiarCampo).toHaveBeenLastCalledWith(puntoA.id, {
    motivo: "Motivo sintético de prueba",
  })
  expect(cambiarCampo.mock.calls.some(([, cambio]) => "lecturas" in cambio)).toBe(false)
})

it("conserva la anotación manual del porcentaje, método y fecha", async () => {
  await render(<Arnes />)
  expect(screen.getByRole("radio", { name: "Manual" })).toHaveProp("accessibilityState", {
    checked: true,
    disabled: false,
  })
  const porcentaje = screen.getByLabelText("Porcentaje de grasa (%)")
  expect(porcentaje).toHaveProp("keyboardType", "decimal-pad")
  await fireEvent.changeText(porcentaje, "18,5")
  await fireEvent.changeText(screen.getByLabelText("Método que usaste"), "Método de prueba")
  await fireEvent.changeText(screen.getByLabelText("Fecha del cálculo (AAAA-MM-DD)"), "2026-09-20")
  expect(cambiarGrasa.mock.calls).toEqual([
    [{ texto: "18,5", metodo: "", fecha: "" }],
    [{ texto: "18,5", metodo: "Método de prueba", fecha: "" }],
    [{ texto: "18,5", metodo: "Método de prueba", fecha: "2026-09-20" }],
  ])
  expect(cambiarCampo).not.toHaveBeenCalled()
})

it("bloqueado desactiva todos los controles", async () => {
  await render(
    <Arnes
      bloqueado
      inicial={{
        [puntoA.id]: { lecturas: ["10,2", "10,4"], texto: "10,2" },
        [puntoB.id]: { noRealizado: true, motivo: "Motivo sintético" },
      }}
      grasaInicial={{ texto: "18,5", metodo: "Método de prueba", fecha: "2026-09-20" }}
    />,
  )
  const controles = screen.getAllByLabelText(/./)
  expect(controles.length).toBeGreaterThanOrEqual(14)
  for (const control of controles) expect(control).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: `No realizado — ${B}` })).toHaveProp(
    "accessibilityState",
    { checked: true, disabled: true },
  )

  await fireEvent.press(screen.getByRole("button", { name: `Quitar lectura 1 — ${A}` }))
  await fireEvent.press(screen.getByRole("button", { name: `Adoptar lectura 2 — ${A}` }))
  await fireEvent.press(screen.getByRole("checkbox", { name: `No realizado — ${A}` }))
  expect(cambiarCampo).not.toHaveBeenCalled()
})

it("sin puntos en la plantilla lo explica y deja anotar la grasa", async () => {
  await render(<Arnes definiciones={[]} />)
  expect(screen.getByText("La plantilla de esta visita no tiene puntos de pliegues.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /Añadir lectura/ })).toBeNull()
  expect(screen.getByLabelText("Porcentaje de grasa (%)")).toBeTruthy()
})

const puntosJP = ["Pectoral", "Abdominal", "Muslo anterior"].map((nombre, n) => ({
  ...puntoA,
  id: `40000000-0000-4000-8000-00000000000${n + 1}`,
  nombre,
  zona: null,
}))
const adoptadosJP = Object.fromEntries(
  puntosJP.map((d) => [d.id, { texto: "36", lecturas: ["10", "12"] }]),
)

it("propone grasa con protocolo y edad en la toma sin sustituir el dato manual hasta adoptarlo", async () => {
  await render(
    <Arnes
      definiciones={puntosJP}
      inicial={adoptadosJP}
      fechaNacimiento="2005-03-10"
      grasaInicial={{ texto: "18,5", metodo: "Método anterior", fecha: "2026-08-01" }}
    />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Jackson-Pollock 3 pliegues" }))
  expect(screen.getByLabelText("Edad en la toma (años)")).toHaveProp("value", "21")
  expect(cambiarGrasa).not.toHaveBeenCalled()
  expect(screen.getByLabelText("Porcentaje de grasa (%)")).toHaveProp("value", "18,5")
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  const usar = screen.getByRole("button", { name: "Usar 29,02 %" })
  await fireEvent.press(usar)
  expect(cambiarGrasa).toHaveBeenLastCalledWith({
    texto: "29,02",
    metodo: "Jackson-Pollock 3 · Siri",
    fecha: "2026-09-24",
  })
  await fireEvent.changeText(screen.getByLabelText("Porcentaje de grasa (%)"), "28,5")
  expect(screen.getByLabelText("Porcentaje de grasa (%)")).toHaveProp("value", "28,5")
  await fireEvent.press(screen.getByRole("radio", { name: "Manual" }))
  expect(screen.getByLabelText("Porcentaje de grasa (%)")).toHaveProp("value", "28,5")
  expect(screen.getByLabelText("Método que usaste")).toHaveProp("value", "Jackson-Pollock 3 · Siri")
})

it("explica los puntos pendientes y no usa lecturas sin un valor adoptado", async () => {
  await render(
    <Arnes
      definiciones={puntosJP}
      inicial={{ ...adoptadosJP, [puntosJP[1]!.id]: { texto: "", lecturas: ["36"] } }}
      fechaNacimiento="2005-03-10"
    />,
  )
  await fireEvent.press(screen.getByRole("radio", { name: "Jackson-Pollock 3 pliegues" }))
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  expect(screen.queryByRole("button", { name: /^Usar .* %$/ })).toBeNull()
  expect(screen.getByRole("alert")).toHaveTextContent(/abdominal/i)
  expect(cambiarGrasa).not.toHaveBeenCalled()
  await fireEvent.changeText(
    screen.getByLabelText("Valor adoptado (mm) — Abdominal, derecha"),
    "36",
  )
  expect(screen.getByRole("button", { name: /^Usar 29,\d+ %$/ })).toBeEnabled()
})

it("pide sexo y edad ausentes y permite completar los datos para calcular", async () => {
  await render(<Arnes definiciones={puntosJP} inicial={adoptadosJP} />)
  await fireEvent.press(screen.getByRole("radio", { name: "Jackson-Pollock 3 pliegues" }))
  expect(screen.getByLabelText("Edad en la toma (años)")).toHaveProp("value", "")
  expect(screen.getByLabelText("Edad en la toma (años)")).toHaveProp("keyboardType", "number-pad")
  expect(screen.queryByRole("button", { name: /^Usar .* %$/ })).toBeNull()
  await fireEvent.changeText(screen.getByLabelText("Edad en la toma (años)"), "21")
  await fireEvent.press(screen.getByRole("radio", { name: "Hombre" }))
  expect(screen.getByRole("button", { name: /^Usar 29,\d+ %$/ })).toBeEnabled()
})

it("no sustituye un valor guardado al cambiar de protocolo y respeta el bloqueo", async () => {
  await render(
    <Arnes
      bloqueado
      definiciones={puntosJP}
      inicial={adoptadosJP}
      grasaInicial={{ texto: "18,5", metodo: "Método anterior", fecha: "2026-08-01" }}
    />,
  )
  for (const control of screen.getAllByRole("radio")) expect(control).toBeDisabled()
  await fireEvent.press(screen.getByRole("radio", { name: "Jackson-Pollock 3 pliegues" }))
  expect(cambiarGrasa).not.toHaveBeenCalled()
  expect(screen.getByLabelText("Porcentaje de grasa (%)")).toHaveProp("value", "18,5")
})
