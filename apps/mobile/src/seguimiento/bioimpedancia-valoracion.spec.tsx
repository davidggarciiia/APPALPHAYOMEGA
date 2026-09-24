import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { DefinicionCorporal } from "@alpha-omega/shared"

import { BloqueBioimpedancia } from "./bioimpedancia-valoracion"
import { CAMPO_CORPORAL_VACIO, type CampoCorporal } from "./valoracion-modelo"

// Definiciones, modelos de báscula y valores sintéticos.
const base = {
  version: 1,
  bloque: "bioimpedancia",
  zona: null,
  lateralidad: null,
  protocolo: null,
  activa: true,
} as const
const A = "Báscula modelo A"
const B = "Báscula modelo B"
const def = (
  n: number,
  magnitud: DefinicionCorporal["magnitud"],
  nombre: string,
  unidad: DefinicionCorporal["unidad"],
  instrumento: string | null,
): DefinicionCorporal => ({
  ...base,
  id: `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  magnitud,
  nombre,
  unidad,
  instrumento,
})

const pesoA = { ...def(1, "peso", "Peso", "kg", A), protocolo: "Protocolo sintético de prueba" }
const muscularB = def(2, "masaMuscular", "Masa muscular", "kg", B)
const grasaA = def(3, "grasa", "Grasa corporal", "%", A)
const libreB = def(4, "masaLibreDeGrasa", "Masa libre de grasa", "kg", B)
const aguaSin = def(5, "agua", "Agua corporal", "l", null)
const masaGrasaA = def(6, "grasa", "Masa grasa", "kg", A)
const visceralA = def(7, "grasaVisceral", "Grasa visceral", "indice", A)

/** Aplica cada cambio como lo hace el editor y deja constancia de la llamada exacta. */
function Bloque({
  definiciones,
  inicial = {},
  bloqueado = false,
  espia,
}: {
  definiciones: DefinicionCorporal[]
  inicial?: Record<string, CampoCorporal>
  bloqueado?: boolean
  espia: jest.Mock
}): React.JSX.Element {
  const [campos, setCampos] = useState(inicial)
  return (
    <BloqueBioimpedancia
      definiciones={definiciones}
      campos={campos}
      bloqueado={bloqueado}
      cambiarCampo={(id, cambio) => {
        espia(id, cambio)
        setCampos((actual) => ({
          ...actual,
          [id]: { ...CAMPO_CORPORAL_VACIO, ...actual[id], ...cambio },
        }))
      }}
    />
  )
}

it("agrupa los campos por modelo de báscula y rotula los que no tienen modelo", async () => {
  await render(
    <Bloque definiciones={[pesoA, muscularB, grasaA, libreB, aguaSin]} espia={jest.fn()} />,
  )
  expect(screen.getAllByRole("header").map((h) => h.props.children)).toEqual([
    "Bioimpedancia",
    A,
    B,
    "Báscula sin identificar",
  ])
  // Cada campo queda con su báscula aunque la plantilla los intercale.
  expect(screen.getAllByLabelText(/\), /).map((c) => c.props.accessibilityLabel)).toEqual([
    `Peso (kg), ${A}`,
    `Grasa corporal (%), ${A}`,
    `Masa muscular (kg), ${B}`,
    `Masa libre de grasa (kg), ${B}`,
    "Agua corporal (l), báscula sin identificar",
  ])
  expect(screen.getByText("Protocolo sintético de prueba")).toBeTruthy()
})

it("muestra la unidad de cada campo y no presenta un índice como kg ni %", async () => {
  await render(<Bloque definiciones={[grasaA, masaGrasaA, visceralA]} espia={jest.fn()} />)
  expect(screen.getByLabelText(`Grasa corporal (%), ${A}`)).toBeTruthy()
  expect(screen.getByLabelText(`Masa grasa (kg), ${A}`)).toBeTruthy()
  const indice = screen.getByLabelText(`Grasa visceral (índice del fabricante), ${A}`)
  expect(indice.props.accessibilityLabel).not.toMatch(/kg|%/)
  expect(screen.getByText("Grasa visceral (índice del fabricante)")).toBeTruthy()
  expect(screen.queryByText(/indice\)/)).toBeNull()
})

it("masa muscular y masa libre de grasa son dos campos con su propio dato", async () => {
  const espia = jest.fn()
  await render(<Bloque definiciones={[muscularB, libreB]} espia={espia} />)
  await fireEvent.changeText(screen.getByLabelText(`Masa muscular (kg), ${B}`), "32,1")
  await fireEvent.changeText(screen.getByLabelText(`Masa libre de grasa (kg), ${B}`), "58,7")
  expect(espia.mock.calls).toEqual([
    [muscularB.id, { texto: "32,1" }],
    [libreB.id, { texto: "58,7" }],
  ])
  expect(screen.getByDisplayValue("32,1")).toBeTruthy()
  expect(screen.getByDisplayValue("58,7")).toBeTruthy()
})

it("el peso de báscula no se confunde con el peso de Medidas", async () => {
  await render(<Bloque definiciones={[pesoA]} espia={jest.fn()} />)
  expect(screen.queryByLabelText("Peso (kg)")).toBeNull()
  expect(screen.getByLabelText(`Peso (kg), ${A}`)).toBeTruthy()
})

it("escribe con coma decimal y muestra lo ya anotado", async () => {
  const espia = jest.fn()
  await render(
    <Bloque
      definiciones={[pesoA, grasaA]}
      inicial={{ [pesoA.id]: { ...CAMPO_CORPORAL_VACIO, texto: "80,5" } }}
      espia={espia}
    />,
  )
  expect(screen.getByLabelText(`Peso (kg), ${A}`).props.value).toBe("80,5")
  const grasa = screen.getByLabelText(`Grasa corporal (%), ${A}`)
  expect(grasa.props.keyboardType).toBe("decimal-pad")
  expect(grasa.props.value).toBe("")
  await fireEvent.changeText(grasa, "23,4")
  expect(espia).toHaveBeenCalledTimes(1)
  expect(espia).toHaveBeenCalledWith(grasaA.id, { texto: "23,4" })
})

it("marca un campo como no realizado con motivo opcional y conserva lo escrito", async () => {
  const espia = jest.fn()
  await render(
    <Bloque
      definiciones={[grasaA]}
      inicial={{ [grasaA.id]: { ...CAMPO_CORPORAL_VACIO, texto: "23,4" } }}
      espia={espia}
    />,
  )
  const marca = screen.getByRole("checkbox", { name: `No realizado — Grasa corporal, ${A}` })
  expect(marca).not.toBeChecked()
  expect(screen.queryByLabelText(`Motivo — Grasa corporal, ${A}`)).toBeNull()

  await fireEvent.press(marca)
  expect(espia).toHaveBeenLastCalledWith(grasaA.id, { noRealizado: true })
  expect(
    screen.getByRole("checkbox", { name: `No realizado — Grasa corporal, ${A}` }),
  ).toBeChecked()
  const valor = screen.getByLabelText(`Grasa corporal (%), ${A}`)
  expect(valor).toBeDisabled()
  expect(valor.props.value).toBe("")

  await fireEvent.changeText(
    screen.getByLabelText(`Motivo — Grasa corporal, ${A}`),
    "Sin báscula disponible",
  )
  expect(espia).toHaveBeenLastCalledWith(grasaA.id, { motivo: "Sin báscula disponible" })

  await fireEvent.press(
    screen.getByRole("checkbox", { name: `No realizado — Grasa corporal, ${A}` }),
  )
  expect(espia).toHaveBeenLastCalledWith(grasaA.id, { noRealizado: false })
  expect(screen.getByLabelText(`Grasa corporal (%), ${A}`).props.value).toBe("23,4")
  expect(espia).toHaveBeenCalledTimes(3)
})

it("bloqueado desactiva valores, motivos y marcas", async () => {
  const espia = jest.fn()
  await render(
    <Bloque
      definiciones={[pesoA, grasaA]}
      inicial={{ [grasaA.id]: { ...CAMPO_CORPORAL_VACIO, noRealizado: true, motivo: "Otro día" } }}
      bloqueado
      espia={espia}
    />,
  )
  const controles = [
    screen.getByLabelText(`Peso (kg), ${A}`),
    screen.getByLabelText(`Grasa corporal (%), ${A}`),
    screen.getByLabelText(`Motivo — Grasa corporal, ${A}`),
    screen.getByRole("checkbox", { name: `No realizado — Peso, ${A}` }),
    screen.getByRole("checkbox", { name: `No realizado — Grasa corporal, ${A}` }),
  ]
  for (const control of controles) expect(control).toBeDisabled()
  await fireEvent.changeText(screen.getByLabelText(`Peso (kg), ${A}`), "81")
  await fireEvent.press(screen.getByRole("checkbox", { name: `No realizado — Peso, ${A}` }))
  expect(espia).not.toHaveBeenCalled()
})

it("sin campos explica que la plantilla de la visita no tiene bioimpedancia", async () => {
  await render(<Bloque definiciones={[]} espia={jest.fn()} />)
  expect(
    screen.getByText("La plantilla de esta visita no tiene campos de bioimpedancia."),
  ).toBeTruthy()
  expect(screen.queryByRole("checkbox")).toBeNull()
})
