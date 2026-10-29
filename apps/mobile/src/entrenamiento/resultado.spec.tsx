import { render, screen } from "@testing-library/react-native"
import { PrescripcionVisible, valoresLegibles, type ResultadoConDistancia } from "./resultado"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
it("el resultado mantiene el recuento de la parte principal aunque también se hizo el calentamiento", async () => {
  const resultado: ResultadoConDistancia = {
    sesionId: "sesion",
    revisionPrescripcion: 0,
    enviadoEn: "2026-10-01T10:00:00.000Z",
    notas: null,
    prescripcion: {
      nombre: "Fuerza",
      ejercicios: [
        {
          id: "calentamiento",
          ejercicioId: "uno",
          nombre: "Movilidad",
          indicaciones: null,
          seccion: "calentamiento",
          series: [{ id: "c", tipoMedicion: "tiempo", pesoKg: null, segundos: 60 }],
        },
        {
          id: "principal",
          ejercicioId: "dos",
          nombre: "Remo",
          indicaciones: null,
          series: [{ id: "p", tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 8 }],
        },
      ],
    },
    series: [
      {
        serieId: "c",
        hecha: true,
        valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 60 },
      },
      {
        serieId: "p",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 8 },
      },
    ],
  }
  await render(<PrescripcionVisible prescripcion={resultado.prescripcion} resultado={resultado} />)
  expect(screen.getByText("1/1")).toBeTruthy()
  expect(screen.getByText("series de la parte principal completadas")).toBeTruthy()
})

it("muestra los kilos con coma también en las etiquetas de las series", () => {
  expect(valoresLegibles({ tipoMedicion: "repeticiones", pesoKg: 67.5, repeticiones: 8 })).toBe(
    "8 rep · 67,5 kg",
  )
})

it("distingue una serie pendiente de una omitida expresamente", async () => {
  const prescripcion: ResultadoConDistancia["prescripcion"] = {
    nombre: "Fuerza",
    ejercicios: [
      {
        id: "e",
        ejercicioId: "catalogo",
        nombre: "Remo",
        indicaciones: null,
        series: ["hecha", "pendiente", "omitida"].map((id) => ({
          id,
          tipoMedicion: "repeticiones",
          pesoKg: 20,
          repeticiones: 8,
        })),
      },
    ],
  }
  const resultado: ResultadoConDistancia = {
    sesionId: "s",
    revisionPrescripcion: 0,
    enviadoEn: "2026-10-01T10:00:00.000Z",
    notas: null,
    prescripcion,
    series: [
      {
        serieId: "hecha",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 8 },
      },
      {
        serieId: "pendiente",
        hecha: false,
      },
      {
        serieId: "omitida",
        hecha: false,
        omitida: true,
      },
    ],
  }
  await render(<PrescripcionVisible prescripcion={prescripcion} resultado={resultado} />)
  expect(screen.getByText("Hecho: 8 rep · 20 kg")).toBeTruthy()
  expect(screen.getByText("Sin hacer")).toBeTruthy()
  expect(screen.getAllByText("Omitida")).toHaveLength(1)
})
