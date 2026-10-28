import { render, screen } from "@testing-library/react-native"
import { PrescripcionVisible, type ResultadoConDistancia } from "./resultado"

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
