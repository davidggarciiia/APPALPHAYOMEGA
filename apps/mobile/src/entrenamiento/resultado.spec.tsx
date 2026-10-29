import { render, screen } from "@testing-library/react-native"
import { tema } from "../tema"
import { PrescripcionVisible, valoresLegibles, type ResultadoConDistancia } from "./resultado"

jest.mock("../componentes/iconos", () => ({ Icono: () => null }))
it("muestra todas las series de lectura, incluidas las del calentamiento, sin duplicar la confirmación", async () => {
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
  expect(screen.getAllByText("60 s")).toHaveLength(2)
  expect(screen.getAllByText("20 kg × 8")).toHaveLength(2)
  expect(screen.getAllByText("1")).toHaveLength(2)
  expect(screen.queryByText("Entrenamiento enviado")).toBeNull()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
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
  expect(screen.getAllByText("20 kg × 8")).toHaveLength(4)
  expect(screen.getByText("Sin hacer")).toBeTruthy()
  expect(screen.getAllByText("Omitida")).toHaveLength(1)
})

it("compara el registro con su prescripción congelada y distingue el RIR bajo y la omisión", async () => {
  const prescripcion: ResultadoConDistancia["prescripcion"] = {
    nombre: "Fuerza",
    ejercicios: [
      {
        id: "e",
        ejercicioId: "catalogo",
        nombre: "Remo original",
        indicaciones: null,
        rir: { min: 3, max: 4 },
        modoRir: "cadaSerie",
        series: ["hecha", "omitida"].map((id) => ({
          id,
          tipoMedicion: "repeticiones",
          pesoKg: 20,
          repeticiones: 8,
          repeticionesMax: 10,
        })),
      },
    ],
  }
  const resultado: ResultadoConDistancia = {
    sesionId: "s",
    revisionPrescripcion: 0,
    enviadoEn: "2026-10-01T10:00:00.000Z",
    notas: "Buena técnica",
    prescripcion,
    series: [
      {
        serieId: "hecha",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 22.5, repeticiones: 9, rir: 1 },
      },
      { serieId: "omitida", hecha: false, omitida: true },
    ],
  }
  await render(
    <PrescripcionVisible
      prescripcion={{ nombre: "Plan cambiado", ejercicios: [] }}
      resultado={resultado}
    />,
  )
  expect(screen.getByRole("header", { name: "Remo original" })).toBeTruthy()
  expect(screen.getByText("22,5 kg × 9")).toBeTruthy()
  expect(screen.getAllByText("20 kg × 8–10")).toHaveLength(2)
  expect(screen.getByRole("text", { name: /Serie 1.*RIR 1.*objetivo 3–4/ })).toHaveStyle({
    backgroundColor: tema.exitoFila,
  })
  expect(screen.getByLabelText("RIR 1, objetivo 3–4")).toHaveStyle({ color: tema.aviso })
  expect(screen.getByRole("text", { name: /Serie 2.*Omitida/ })).toHaveStyle({ opacity: 0.5 })
  expect(screen.getByText("Buena técnica")).toBeTruthy()
})

it("presenta el registro comprometido sin conexión sin fabricar un resultado enviado", async () => {
  const prescripcion: ResultadoConDistancia["prescripcion"] = {
    nombre: "Carrera",
    ejercicios: [
      {
        id: "e",
        ejercicioId: "catalogo",
        nombre: "Paseo",
        indicaciones: null,
        series: [
          { id: "s", tipoMedicion: "distancia", pesoKg: null, metros: 20 },
          { id: "pendiente", tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
        ],
      },
    ],
  }
  await render(
    <PrescripcionVisible
      prescripcion={prescripcion}
      registro={{
        checkin: null,
        cierre: null,
        notas: "Sin conexión",
        series: [
          {
            serieId: "s",
            hecha: true,
            tipoMedicion: "distancia",
            pesoKg: null,
            metros: 25,
            rir: 3,
          },
          {
            serieId: "pendiente",
            hecha: false,
            tipoMedicion: "tiempo",
            pesoKg: null,
            segundos: null,
          },
        ],
      }}
    />,
  )
  expect(screen.getByText("25 m")).toBeTruthy()
  expect(screen.getByText("20 m")).toBeTruthy()
  expect(screen.getByText("Sin hacer")).toBeTruthy()
  expect(screen.getByText("Sin conexión")).toBeTruthy()
  expect(screen.queryByText(/enviado/i)).toBeNull()
})

it("comparte las series en revisión, compara mínimos en su unidad y muestra el aumento de carga", async () => {
  const prescripcion: ResultadoConDistancia["prescripcion"] = {
    nombre: "Fuerza",
    ejercicios: [
      {
        id: "e",
        ejercicioId: "catalogo",
        nombre: "Remo",
        indicaciones: null,
        rir: { min: 3, max: 4 },
        series: ["cumple", "reps", "rir", "omitida", "sin-rir"].map((id) => ({
          id,
          tipoMedicion: "repeticiones",
          pesoKg: 20,
          repeticiones: 8,
          repeticionesMax: 10,
        })),
      },
      {
        id: "m",
        ejercicioId: "transporte",
        nombre: "Transporte",
        indicaciones: null,
        series: [{ id: "metros", tipoMedicion: "distancia", pesoKg: 32, metros: 20 }],
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
        serieId: "cumple",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 22.5, repeticiones: 9, rir: 3 },
      },
      {
        serieId: "reps",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 7, rir: 3 },
      },
      {
        serieId: "rir",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10, rir: 1 },
      },
      { serieId: "omitida", hecha: false, omitida: true },
      {
        serieId: "sin-rir",
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
      },
      {
        serieId: "metros",
        hecha: true,
        valores: { tipoMedicion: "distancia", pesoKg: 32, metros: 18 },
      },
    ],
  }
  await render(
    <PrescripcionVisible prescripcion={prescripcion} resultado={resultado} revision={{}} />,
  )
  expect(screen.getAllByText("PRESCRITO")).toHaveLength(2)
  expect(screen.getByText("+2,5")).toBeTruthy()
  expect(screen.getByRole("text", { name: /Serie 1.*22,5 kg × 9/ })).toHaveStyle({
    backgroundColor: tema.exitoFila,
  })
  expect(screen.getByRole("text", { name: /Serie 2.*20 kg × 7/ })).toHaveStyle({
    backgroundColor: tema.acentoSuave,
  })
  expect(screen.getByRole("text", { name: /Serie 3.*RIR 1/ })).toHaveStyle({
    backgroundColor: tema.acentoSuave,
  })
  expect(screen.getByRole("text", { name: /Serie 4.*Omitida/ })).toHaveStyle({ opacity: 0.5 })
  expect(screen.getByRole("text", { name: /Serie 5.*RIR sin registrar/ })).not.toHaveStyle({
    backgroundColor: tema.exitoFila,
  })
  expect(screen.getByRole("text", { name: /Serie 1.*32 kg × 18 m/ })).toHaveStyle({
    backgroundColor: tema.acentoSuave,
  })
})
