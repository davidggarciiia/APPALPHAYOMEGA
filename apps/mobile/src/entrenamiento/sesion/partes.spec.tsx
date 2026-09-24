import { fireEvent, render, screen } from "@testing-library/react-native"
import { PrescripcionSchema, type EjercicioPrescrito } from "@alpha-omega/shared"
import { registroParaEnviar } from "../registro-modelo"
import { ListaMarcable } from "./partes"

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
