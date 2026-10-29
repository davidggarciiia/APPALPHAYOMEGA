import { fireEvent, render, screen } from "@testing-library/react-native"

import { nuevoEjercicio, type EjercicioDelConstructor } from "./modelo"
import { PanelEjercicio, pautaDeFila, TablaPrincipal } from "./tabla"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

// Ejercicio sintético cargado de una rutina con [10 repeticiones, 20 m].
let contador = 0
const nuevoId = () => `30000000-0000-4000-8000-${String(++contador).padStart(12, "0")}`
function mezclado(): EjercicioDelConstructor {
  return {
    ...nuevoEjercicio(
      { id: "10000000-0000-4000-8000-000000000001", nombre: "Transporte" },
      "principal",
      nuevoId,
    ),
    tipo: "repeticiones",
    series: "2",
    objetivo: "10",
    mezclaUnidades: true,
  }
}

/** El mismo ejercicio pautado en una sola unidad. */
function sinMezcla(): EjercicioDelConstructor {
  const e = mezclado()
  delete e.mezclaUnidades
  return e
}

describe("ejercicio que mezcla unidades en el constructor", () => {
  it("advierte de series distintas y exige decidir antes de unificar su pauta", async () => {
    const ejercicio = { ...sinMezcla(), seriesDistintas: true as const }
    const cambiar = jest.fn()
    expect(pautaDeFila(ejercicio)).toBe("Series distintas: revisar")
    await render(
      <PanelEjercicio
        ejercicio={ejercicio}
        nombreCliente="Lara"
        cambiar={cambiar}
        verTecnica={jest.fn()}
      />,
    )
    expect(screen.getByText(/cargas u objetivos distintos/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole("button", { name: "Pautar todas las series por igual" }))
    expect(cambiar).toHaveBeenCalledWith(ejercicio.id, {
      seriesDistintas: undefined,
      objetivo: "",
      carga: "",
    })
  })

  it("la fila lo dice en vez de parecer correcta", async () => {
    await render(
      <TablaPrincipal
        ejercicios={[mezclado()]}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
        ajustar={jest.fn()}
        quitar={jest.fn()}
        mover={jest.fn()}
        ancha
      />,
    )
    expect(screen.getByText("Mezcla unidades: revisar")).toBeTruthy()
  })

  it("elegir una unidad en el panel, aunque sea la mostrada, la aplica a todas las series y quita la marca", async () => {
    const cambiar = jest.fn()
    await render(
      <PanelEjercicio
        ejercicio={mezclado()}
        nombreCliente="Lara"
        cambiar={cambiar}
        verTecnica={jest.fn()}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Más" }))
    expect(screen.getByText(/pauta este ejercicio en varias unidades/)).toBeTruthy()
    await fireEvent.press(screen.getByLabelText("Medir Transporte en repeticiones"))
    expect(cambiar).toHaveBeenCalledWith(expect.any(String), {
      tipo: "repeticiones",
      objetivo: "",
      mezclaUnidades: undefined,
    })
  })

  it("sin mezcla, pulsar la unidad que ya tiene no cambia nada", async () => {
    const cambiar = jest.fn()
    const unaUnidad = sinMezcla()
    await render(
      <PanelEjercicio
        ejercicio={unaUnidad}
        nombreCliente="Lara"
        cambiar={cambiar}
        verTecnica={jest.fn()}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Más" }))
    expect(screen.queryByText(/varias unidades/)).toBeNull()
    await fireEvent.press(screen.getByLabelText("Medir Transporte en repeticiones"))
    expect(cambiar).not.toHaveBeenCalled()
  })

  it("el PDF no imprime la unidad de la primera serie como si fuera de todas", () => {
    expect(pautaDeFila(mezclado())).toBe("Mezcla unidades: revisar")
    const unaUnidad = sinMezcla()
    expect(pautaDeFila(unaUnidad)).toBe("2 × 10")
    expect(pautaDeFila({ ...unaUnidad, tipo: "distancia", objetivo: "20" })).toBe("2 × 20 m")
  })
})

it("muestra cinco celdas táctiles sin teclado y una sola cabecera en móvil", async () => {
  const ejercicio = { ...sinMezcla(), calibrar: false, carga: "60" }
  const ajustar = jest.fn()
  const elegir = jest.fn()
  await render(
    <TablaPrincipal
      ejercicios={[ejercicio, { ...ejercicio, id: "otra", nombre: "Remo" }]}
      elegido={null}
      elegir={elegir}
      cambiar={jest.fn()}
      ajustar={ajustar}
      quitar={jest.fn()}
      mover={jest.fn()}
      ancha={false}
    />,
  )
  expect(screen.queryAllByDisplayValue(/.*/)).toHaveLength(0)
  for (const [etiqueta, campo] of [
    ["Series de Transporte", "series"],
    ["Repeticiones de Transporte", "objetivo"],
    ["RIR de Transporte", "rir"],
    ["Descanso de Transporte", "descanso"],
    ["Carga inicial de Transporte en kg", "carga"],
  ]) {
    const celda = screen.getByRole("button", { name: etiqueta })
    expect(celda).toHaveStyle({ minHeight: 44 })
    await fireEvent.press(celda)
    expect(ajustar).toHaveBeenLastCalledWith(ejercicio.id, campo)
  }
  for (const titulo of ["Series", "Reps", "RIR", "Desc.", "Kg"])
    expect(screen.getAllByText(titulo)).toHaveLength(1)
  await fireEvent.press(screen.getByRole("button", { name: "Transporte: editar detalles" }))
  expect(elegir).toHaveBeenCalledWith(ejercicio.id)
  expect(screen.getByRole("button", { name: "Bajar Transporte" })).toHaveStyle({
    width: 44,
    height: 44,
  })
  expect(screen.getByRole("button", { name: "Quitar Transporte" })).toHaveStyle({ minHeight: 44 })
})

it("mantiene controles principales en la hoja y guarda los detalles dentro de Más", async () => {
  const ejercicio = { ...sinMezcla(), calibrar: false, carga: "60", subida: "2,5" }
  const cambiar = jest.fn()
  const alListo = jest.fn()
  await render(
    <PanelEjercicio
      ejercicio={ejercicio}
      nombreCliente="Lara"
      cambiar={cambiar}
      verTecnica={jest.fn()}
      alListo={alListo}
    />,
  )
  expect(screen.queryByLabelText("Calibrar la carga")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Aumentar Series de Transporte" }))
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { series: "3" })
  await fireEvent.press(screen.getByRole("button", { name: "Subida 5 kg" }))
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { subida: "5" })
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 3" }))
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { rir: "3" })
  await fireEvent.press(screen.getByRole("button", { name: "Descanso 2 min" }))
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { descanso: "2 min" })
  await fireEvent.press(screen.getByRole("button", { name: "Más" }))
  expect(screen.getByLabelText("Calibrar la carga")).toBeOnTheScreen()
  expect(screen.getByLabelText("Nota para Lara")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }))
  expect(alListo).toHaveBeenCalled()
})

it("bloquea Listo y comunica texto manual inválido sin aceptarlo", async () => {
  const cambiar = jest.fn()
  const alCambiarValidez = jest.fn()
  await render(
    <PanelEjercicio
      ejercicio={sinMezcla()}
      nombreCliente="Lara"
      cambiar={cambiar}
      verTecnica={jest.fn()}
      alListo={jest.fn()}
      alCambiarValidez={alCambiarValidez}
    />,
  )
  await fireEvent.press(screen.getByRole("button", { name: "Escribir Series de Transporte: 2" }))
  await fireEvent.changeText(screen.getByLabelText("Series de Transporte"), "1,5")
  expect(cambiar).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "Listo" })).toBeDisabled()
  expect(alCambiarValidez).toHaveBeenLastCalledWith(false)
})

it("permite volver a vaciar carga, subida y RIR opcionales desde la hoja", async () => {
  const ejercicio = { ...sinMezcla(), carga: "60", subida: "2,5", calibrar: false }
  const cambiar = jest.fn()
  await render(
    <PanelEjercicio
      ejercicio={ejercicio}
      nombreCliente="Lara"
      cambiar={cambiar}
      verTecnica={jest.fn()}
      alListo={jest.fn()}
    />,
  )
  await fireEvent.press(
    screen.getByRole("button", { name: "Escribir Carga inicial de Transporte en kg: 60" }),
  )
  await fireEvent.changeText(screen.getByLabelText("Carga inicial de Transporte en kg"), "")
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { carga: "", calibrar: false })
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("button", { name: "Más" }))
  await fireEvent.press(
    screen.getByRole("button", { name: "Escribir Subida de Transporte en kg: 2,5" }),
  )
  await fireEvent.changeText(screen.getByLabelText("Subida de Transporte en kg"), "")
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { subida: "" })
  expect(screen.getByRole("button", { name: "Listo" })).toBeEnabled()
  await fireEvent.press(screen.getByRole("radio", { name: "RIR 3" }))
  await fireEvent.press(screen.getByRole("button", { name: "Sin objetivo" }))
  expect(cambiar).toHaveBeenLastCalledWith(ejercicio.id, { rir: "" })
})
