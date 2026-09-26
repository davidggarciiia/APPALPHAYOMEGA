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
  it("la fila lo dice en vez de parecer correcta", async () => {
    await render(
      <TablaPrincipal
        ejercicios={[mezclado()]}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
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
