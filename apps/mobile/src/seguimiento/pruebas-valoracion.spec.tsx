import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { crearPruebaEstandar, type DefinicionPrueba } from "@alpha-omega/shared"

import { BloquePruebas, type ReferenciaPrueba } from "./pruebas-valoracion"
import { CAMPO_PRUEBA_VACIO, type CampoPrueba } from "./valoracion-modelo"

// Definiciones y valores sintéticos.
const id = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const flexiones = crearPruebaEstandar("flexiones1min", id(1))
const cooper = crearPruebaEstandar("cooper", id(2))
const dominadas = crearPruebaEstandar("dominadas", id(3), "Agarre prono")
const aguante = crearPruebaEstandar("suspension", id(4))
const conProtocolo: DefinicionPrueba = {
  ...flexiones,
  protocolo: "Texto sintético del entrenador",
}

/** El editor guarda cada campo que devuelve el bloque, como hará la visita. */
function Banco({
  definiciones,
  cambiar,
  referencias = [],
  inicial = {},
  bloqueado = false,
}: {
  definiciones: DefinicionPrueba[]
  cambiar: (id: string, campo: CampoPrueba) => void
  referencias?: ReferenciaPrueba[]
  inicial?: Record<string, CampoPrueba>
  bloqueado?: boolean
}): React.JSX.Element {
  const [campos, setCampos] = useState(inicial)
  return (
    <BloquePruebas
      definiciones={definiciones}
      campos={campos}
      referencias={referencias}
      bloqueado={bloqueado}
      cambiar={(clave, campo) => {
        cambiar(clave, campo)
        setCampos((actual) => ({ ...actual, [clave]: campo }))
      }}
    />
  )
}

const registrado = (cambio: Partial<CampoPrueba> = {}): CampoPrueba => ({
  ...CAMPO_PRUEBA_VACIO,
  estado: "registrado",
  ...cambio,
})

it("muestra nombre, variante, protocolo, duración e instrumento, y empieza pendiente", async () => {
  const cambiar = jest.fn()
  await render(<Banco definiciones={[conProtocolo, dominadas, cooper]} cambiar={cambiar} />)
  expect(screen.getByText("Flexiones en 1 minuto")).toBeTruthy()
  expect(screen.getByText("Protocolo: Texto sintético del entrenador")).toBeTruthy()
  expect(screen.getByText("60 s")).toBeTruthy()
  expect(screen.getByText("Dominadas · Agarre prono")).toBeTruthy()
  expect(screen.getByText("Banda pectoral")).toBeTruthy()
  expect(screen.getByRole("radio", { name: "Pendiente — Flexiones en 1 minuto" })).toBeChecked()
  expect(screen.queryByLabelText(/^Flexiones en 1 minuto: /)).toBeNull()
  expect(cambiar).not.toHaveBeenCalled()
})

it("registra flexiones con 0 repeticiones como un cero real, sin rellenar nada antes", async () => {
  const cambiar = jest.fn()
  await render(<Banco definiciones={[flexiones]} cambiar={cambiar} />)
  await fireEvent.press(
    screen.getByRole("radio", { name: "Registrar resultado — Flexiones en 1 minuto" }),
  )
  const campo = screen.getByLabelText("Flexiones en 1 minuto: Repeticiones válidas (reps)")
  expect(campo).toHaveDisplayValue("")
  expect(campo.props.keyboardType).toBe("decimal-pad")
  await fireEvent.changeText(campo, "0")
  expect(cambiar.mock.calls).toEqual([
    [flexiones.id, registrado()],
    [flexiones.id, registrado({ valores: { repeticiones: "0" } })],
  ])
  expect(screen.getByText("Repeticiones válidas (reps)")).toBeTruthy()
})

it("Cooper sin FC guarda solo distancia y duración, con la principal primero", async () => {
  const cambiar = jest.fn()
  await render(<Banco definiciones={[cooper]} cambiar={cambiar} />)
  await fireEvent.press(screen.getByRole("radio", { name: "Registrar resultado — Cooper" }))
  // Las métricas empiezan en mayúscula; fecha y notas, no.
  const metricas = screen.getAllByLabelText(/^Cooper: [A-Z]/)
  expect(metricas.map((c) => c.props.accessibilityLabel)).toEqual([
    "Cooper: Distancia (m)",
    "Cooper: Duración (s)",
    "Cooper: FC media (lpm), opcional",
    "Cooper: FC máxima (lpm), opcional",
    "Cooper: FC final (lpm), opcional",
    "Cooper: FC de recuperación (lpm), opcional",
    "Cooper: Tiempo hasta la FC de recuperación (s), opcional",
  ])
  await fireEvent.changeText(screen.getByLabelText("Cooper: Distancia (m)"), "2400,5")
  await fireEvent.changeText(screen.getByLabelText("Cooper: Duración (s)"), "720")
  expect(cambiar.mock.calls).toEqual([
    [cooper.id, registrado()],
    [cooper.id, registrado({ valores: { distancia: "2400,5" } })],
    [cooper.id, registrado({ valores: { distancia: "2400,5", duracion: "720" } })],
  ])
})

it("marca la FC como opcional y no las métricas obligatorias", async () => {
  await render(
    <Banco definiciones={[cooper]} cambiar={jest.fn()} inicial={{ [cooper.id]: registrado() }} />,
  )
  expect(screen.getByText("FC media (lpm) · opcional")).toBeTruthy()
  expect(screen.getByText("FC de recuperación (lpm) · opcional")).toBeTruthy()
  expect(screen.getByText("Distancia (m)")).toBeTruthy()
  expect(screen.getByText("Duración (s)")).toBeTruthy()
  expect(screen.queryByText(/Distancia.*opcional|Duración.*opcional/)).toBeNull()
})

it("registra protocolo incompleto, otra fecha y notas avisando de que las verá el cliente", async () => {
  const cambiar = jest.fn()
  await render(
    <Banco
      definiciones={[flexiones]}
      cambiar={cambiar}
      inicial={{ [flexiones.id]: registrado({ valores: { repeticiones: "30" } }) }}
    />,
  )
  // Nada viene marcado: el entrenador indica si se completó el protocolo.
  expect(
    screen.getByRole("radio", { name: "Protocolo completo: sí — Flexiones en 1 minuto" }),
  ).not.toBeChecked()
  expect(
    screen.getByRole("radio", { name: "Protocolo completo: no — Flexiones en 1 minuto" }),
  ).not.toBeChecked()
  await fireEvent.press(
    screen.getByRole("radio", { name: "Protocolo completo: no — Flexiones en 1 minuto" }),
  )
  await fireEvent.changeText(
    screen.getByLabelText("Flexiones en 1 minuto: fecha si se hizo otro día (AAAA-MM-DD)"),
    "2026-09-20",
  )
  await fireEvent.changeText(
    screen.getByLabelText("Flexiones en 1 minuto: notas"),
    "Paró a los 45 s",
  )
  expect(screen.getByText("El cliente verá estas notas al publicar.")).toBeTruthy()
  expect(cambiar).toHaveBeenLastCalledWith(
    flexiones.id,
    registrado({
      valores: { repeticiones: "30" },
      protocoloCompleto: false,
      fecha: "2026-09-20",
      notas: "Paró a los 45 s",
    }),
  )
})

it("marca una prueba no realizada con motivo opcional y sin campos de resultado", async () => {
  const cambiar = jest.fn()
  await render(<Banco definiciones={[dominadas]} cambiar={cambiar} />)
  await fireEvent.press(
    screen.getByRole("radio", { name: "No realizada — Dominadas · Agarre prono" }),
  )
  expect(screen.queryByLabelText("Dominadas · Agarre prono: Repeticiones (reps)")).toBeNull()
  expect(cambiar).toHaveBeenLastCalledWith(dominadas.id, {
    ...CAMPO_PRUEBA_VACIO,
    estado: "noRealizado",
  })
  await fireEvent.changeText(
    screen.getByLabelText("Dominadas · Agarre prono: motivo (opcional)"),
    "Molestia en el hombro",
  )
  expect(cambiar).toHaveBeenLastCalledWith(dominadas.id, {
    ...CAMPO_PRUEBA_VACIO,
    estado: "noRealizado",
    motivo: "Molestia en el hombro",
  })
  expect(screen.getByText("El cliente verá el motivo al publicar.")).toBeTruthy()
  expect(
    screen.getByRole("radio", { name: "No realizada — Dominadas · Agarre prono" }),
  ).toBeChecked()
})

it("muestra la referencia anterior con su fecha, solo lectura y sin rellenar el resultado", async () => {
  const cambiar = jest.fn()
  const referencias: ReferenciaPrueba[] = [
    { definicionId: flexiones.id, fecha: "2025-12-01", valores: { repeticiones: 25 } },
    { definicionId: flexiones.id, fecha: "2026-03-12", valores: { repeticiones: 31 } },
    { definicionId: cooper.id, fecha: "2026-03-12", valores: { distancia: 2450.5, fcMedia: 160 } },
  ]
  await render(
    <Banco definiciones={[flexiones, cooper]} cambiar={cambiar} referencias={referencias} />,
  )
  expect(screen.getByText("Anterior · 12 mar 2026: 31 reps")).toBeTruthy()
  expect(screen.getByText("Anterior · 12 mar 2026: 2450,5 m")).toBeTruthy()
  expect(screen.queryByText(/25 reps/)).toBeNull()
  await fireEvent.press(
    screen.getByRole("radio", { name: "Registrar resultado — Flexiones en 1 minuto" }),
  )
  const campo = screen.getByLabelText("Flexiones en 1 minuto: Repeticiones válidas (reps)")
  expect(campo).toHaveDisplayValue("")
  expect(campo.props.placeholder).not.toMatch(/31/)
  expect(cambiar).toHaveBeenLastCalledWith(flexiones.id, registrado())
})

it("dominadas y aguante en barra son pruebas distintas con unidades distintas", async () => {
  const cambiar = jest.fn()
  await render(
    <Banco
      definiciones={[dominadas, aguante]}
      cambiar={cambiar}
      inicial={{ [dominadas.id]: registrado(), [aguante.id]: registrado() }}
      referencias={[
        { definicionId: dominadas.id, fecha: "2026-03-12", valores: { repeticiones: 8 } },
      ]}
    />,
  )
  expect(screen.queryByLabelText(/^Dominadas.*\(s\)/)).toBeNull()
  expect(screen.queryByLabelText(/^Aguante en barra: .*\(reps\)/)).toBeNull()
  await fireEvent.changeText(
    screen.getByLabelText("Dominadas · Agarre prono: Repeticiones (reps)"),
    "8",
  )
  await fireEvent.changeText(screen.getByLabelText("Aguante en barra: Duración (s)"), "45,5")
  expect(cambiar.mock.calls).toEqual([
    [dominadas.id, registrado({ valores: { repeticiones: "8" } })],
    [aguante.id, registrado({ valores: { duracion: "45,5" } })],
  ])
  expect(screen.getAllByText(/^Anterior/).map((t) => t.props.children)).toEqual([
    "Anterior · 12 mar 2026: 8 reps",
  ])
})

it("con el bloque bloqueado no se puede cambiar nada", async () => {
  const cambiar = jest.fn()
  await render(
    <Banco
      bloqueado
      definiciones={[flexiones]}
      cambiar={cambiar}
      inicial={{ [flexiones.id]: registrado({ valores: { repeticiones: "30" } }) }}
    />,
  )
  for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled()
  for (const campo of screen.getAllByLabelText(/^Flexiones en 1 minuto: /))
    expect(campo.props.editable).toBe(false)
  await fireEvent.press(screen.getByRole("radio", { name: "No realizada — Flexiones en 1 minuto" }))
  expect(cambiar).not.toHaveBeenCalled()
})

it("sin pruebas en la visita lo explica", async () => {
  await render(<Banco definiciones={[]} cambiar={jest.fn()} />)
  expect(screen.getByText("Esta visita no tiene pruebas en su plantilla.")).toBeTruthy()
  expect(screen.queryByRole("radio")).toBeNull()
})
