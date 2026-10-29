import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { BloqueSchema, type Bloque } from "@alpha-omega/shared"

import { nuevoEjercicio } from "./modelo"
import { EditorDeBloque, ListaDeSeccion } from "./partes"

jest.mock("../../componentes/iconos", () => ({ Icono: () => null }))

const vacio: Bloque = { objetivos: [], fases: [], deportes: [], notas: [] }

function EditorConEstado({
  inicial,
  observar,
}: {
  inicial: Bloque
  observar?: (bloque: Bloque) => void
}): React.JSX.Element {
  const [bloque, cambiar] = useState(inicial)
  return (
    <EditorDeBloque
      bloque={bloque}
      semanas={52}
      cambiar={(valor) => {
        cambiar(valor)
        observar?.(valor)
      }}
    />
  )
}

describe("ListaDeSeccion · móvil", () => {
  it("muestra la pauta en su unidad y abre los detalles al tocar el ejercicio", async () => {
    const ejercicio = {
      ...nuevoEjercicio({ id: "arrastre", nombre: "Arrastre" }, "calentamiento", () => "fila"),
      tipo: "distancia" as const,
      objetivo: "20",
    }
    const elegir = jest.fn()
    const quitar = jest.fn()
    await render(
      <ListaDeSeccion
        ejercicios={[ejercicio]}
        elegido={null}
        elegir={elegir}
        cambiar={jest.fn()}
        quitar={quitar}
      />,
    )
    expect(screen.getByText("20 m")).toBeOnTheScreen()
    expect(screen.queryByLabelText("Metros de Arrastre")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Arrastre: editar detalles" }))
    expect(elegir).toHaveBeenCalledWith("fila")
    await fireEvent.press(screen.getByRole("button", { name: "Quitar Arrastre" }))
    expect(quitar).toHaveBeenCalledWith("fila")
  })

  it("conserva la dosis escrita y no resume con la primera unidad una pauta heterogénea", async () => {
    const base = nuevoEjercicio({ id: "movilidad", nombre: "Movilidad" }, "final", () => "fila")
    const vista = await render(
      <ListaDeSeccion
        ejercicios={[{ ...base, dosis: "30 s por lado" }]}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
        quitar={jest.fn()}
      />,
    )
    expect(screen.getByText("30 s por lado")).toBeOnTheScreen()
    await vista.rerender(
      <ListaDeSeccion
        ejercicios={[{ ...base, mezclaUnidades: true }]}
        elegido={null}
        elegir={jest.fn()}
        cambiar={jest.fn()}
        quitar={jest.fn()}
      />,
    )
    expect(screen.getByText("Mezcla unidades: revisar")).toBeOnTheScreen()
  })
})

describe("EditorDeBloque · fases", () => {
  it("aplica una descarga editable y permite volver a una fase sin ajustes", async () => {
    const observar = jest.fn()
    await render(
      <EditorConEstado
        inicial={{ ...vacio, fases: [{ desde: 1, hasta: 1, nombre: "Base", detalle: null }] }}
        observar={observar}
      />,
    )
    expect(screen.queryByLabelText("Carga en porcentaje de la fase 1")).toBeNull()
    await fireEvent.press(screen.getByRole("button", { name: "Descarga para la fase 1" }))
    expect(observar.mock.calls.at(-1)![0].fases[0].ajustes).toEqual({
      rirCompuestos: { min: 3, max: 4 },
      rirAccesorios: { min: 3, max: 4 },
      factorSeries: 0.5,
      factorCarga: 0.875,
    })
    expect(screen.getByLabelText("Carga en porcentaje de la fase 1")).toHaveProp(
      "keyboardType",
      "decimal-pad",
    )
    await fireEvent.changeText(screen.getByLabelText("Carga en porcentaje de la fase 1"), "90")
    await fireEvent.changeText(screen.getByLabelText("Series en porcentaje de la fase 1"), "60")
    await fireEvent.changeText(screen.getByLabelText("RIR mínimo de accesorios de la fase 1"), "2")
    expect(observar.mock.calls.at(-1)![0].fases[0].ajustes).toEqual({
      rirCompuestos: { min: 3, max: 4 },
      rirAccesorios: { min: 2, max: 4 },
      factorSeries: 0.6,
      factorCarga: 0.9,
    })
    await fireEvent.press(screen.getByRole("button", { name: "Quitar ajustes de la fase 1" }))
    expect(observar.mock.calls.at(-1)![0].fases[0].ajustes).toBeUndefined()
  })

  it.each([
    ["Mayor estímulo", { min: 1, max: 2 }, { min: 1, max: 1 }],
    ["Vuelta", { min: 3, max: 3 }, { min: 2, max: 3 }],
  ])(
    "ofrece el predefinido %s sin recortar series ni cargas",
    async (nombre, compuestos, accesorios) => {
      const observar = jest.fn()
      await render(
        <EditorConEstado
          inicial={{ ...vacio, fases: [{ desde: 1, hasta: 1, nombre: "Base", detalle: null }] }}
          observar={observar}
        />,
      )
      await fireEvent.press(screen.getByRole("button", { name: `${nombre} para la fase 1` }))
      expect(observar.mock.calls.at(-1)![0].fases[0].ajustes).toEqual({
        rirCompuestos: compuestos,
        rirAccesorios: accesorios,
      })
    },
  )

  it("conserva el ajuste inválido para bloquear la publicación y explica el rango", async () => {
    const observar = jest.fn()
    await render(
      <EditorConEstado
        inicial={{ ...vacio, fases: [{ desde: 1, hasta: 1, nombre: "Base", detalle: null }] }}
        observar={observar}
      />,
    )
    await fireEvent.press(screen.getByRole("button", { name: "Descarga para la fase 1" }))
    await fireEvent.changeText(screen.getByLabelText("Carga en porcentaje de la fase 1"), "40")
    expect(BloqueSchema.safeParse(observar.mock.calls.at(-1)![0]).success).toBe(false)
    expect(screen.getByRole("alert")).toHaveTextContent("Carga entre 50 y 110 %.")
  })

  it("sin fases no pinta un contenedor vacío: dejaba un hueco entre «Fases» y «Añadir fase»", async () => {
    await render(<EditorDeBloque bloque={vacio} semanas={6} cambiar={jest.fn()} />)
    expect(screen.getByRole("header", { name: "Fases" })).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Añadir fase" })).toBeOnTheScreen()
    expect(screen.queryByTestId("fases")).toBeNull()
  })

  it("con fases las muestra", async () => {
    const conFase: Bloque = {
      ...vacio,
      fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }],
    }
    await render(<EditorDeBloque bloque={conFase} semanas={6} cambiar={jest.fn()} />)
    expect(screen.getByTestId("fases")).toBeOnTheScreen()
    expect(screen.getByDisplayValue("Base")).toBeOnTheScreen()
  })

  it.each(["Primera", "Última"])("permite vaciar y reescribir la %s semana", async (campo) => {
    await render(
      <EditorConEstado
        inicial={{ ...vacio, fases: [{ desde: 1, hasta: 12, nombre: "Base", detalle: null }] }}
      />,
    )
    const etiqueta = `${campo} semana de la fase 1`
    await fireEvent.changeText(screen.getByLabelText(etiqueta), "")
    expect(screen.getByLabelText(etiqueta)).toHaveDisplayValue("")
    await fireEvent.changeText(screen.getByLabelText(etiqueta), "3")
    expect(screen.getByLabelText(etiqueta)).toHaveDisplayValue("3")
  })

  it("conserva el vacío como un valor inválido al publicar y avisa al perder foco", async () => {
    const bloque: Bloque = {
      ...vacio,
      fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }],
    }
    const cambiar = jest.fn()
    await render(<EditorDeBloque bloque={bloque} semanas={6} cambiar={cambiar} />)
    await fireEvent.changeText(screen.getByLabelText("Primera semana de la fase 1"), "")
    const actualizado: Bloque = cambiar.mock.calls[0]![0]
    expect(actualizado.fases[0]!.desde).toBe(0)
    expect(BloqueSchema.safeParse(actualizado).success).toBe(false)
    await fireEvent(screen.getByLabelText("Primera semana de la fase 1"), "blur")
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe semanas de 1 a 52.")
  })

  it("muestra vacía una semana recuperada con valor cero", async () => {
    const vista = await render(
      <EditorDeBloque
        bloque={{ ...vacio, fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }] }}
        semanas={6}
        cambiar={jest.fn()}
      />,
    )
    await vista.rerender(
      <EditorDeBloque
        bloque={{ ...vacio, fases: [{ desde: 0, hasta: 0, nombre: "Base", detalle: null }] }}
        semanas={6}
        cambiar={jest.fn()}
      />,
    )
    expect(screen.getByLabelText("Primera semana de la fase 1")).toHaveDisplayValue("")
    expect(screen.getByLabelText("Última semana de la fase 1")).toHaveDisplayValue("")
  })

  it("rechaza texto no numérico sin sustituir la semana escrita", async () => {
    const cambiar = jest.fn()
    await render(
      <EditorDeBloque
        bloque={{ ...vacio, fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }] }}
        semanas={6}
        cambiar={cambiar}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Primera semana de la fase 1"), "-3")
    expect(screen.getByLabelText("Primera semana de la fase 1")).toHaveDisplayValue("1")
    expect(cambiar).not.toHaveBeenCalled()
  })

  it("conserva una semana fuera de rango y la señala al perder foco", async () => {
    await render(
      <EditorConEstado
        inicial={{ ...vacio, fases: [{ desde: 1, hasta: 3, nombre: "Base", detalle: null }] }}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Última semana de la fase 1"), "53")
    await fireEvent(screen.getByLabelText("Última semana de la fase 1"), "blur")
    expect(screen.getByLabelText("Última semana de la fase 1")).toHaveDisplayValue("53")
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe semanas de 1 a 52.")
  })

  it("al quitar una fase no conserva su texto en la siguiente", async () => {
    await render(
      <EditorConEstado
        inicial={{
          ...vacio,
          fases: [
            { desde: 1, hasta: 3, nombre: "Base", detalle: null },
            { desde: 4, hasta: 6, nombre: "Fuerza", detalle: null },
          ],
        }}
      />,
    )
    await fireEvent.changeText(screen.getByLabelText("Primera semana de la fase 1"), "")
    await fireEvent.press(screen.getByRole("button", { name: "Quitar la fase 1" }))
    expect(screen.getByLabelText("Primera semana de la fase 1")).toHaveDisplayValue("4")
    expect(screen.getByLabelText("Última semana de la fase 1")).toHaveDisplayValue("6")
  })
})
