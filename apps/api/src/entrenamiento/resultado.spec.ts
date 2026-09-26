import { PrescripcionSchema } from "@alpha-omega/shared"

import { construirResultado } from "./resultado.js"

const serie = (n: number): string => `1111111${String(n)}-1111-4111-8111-111111111111`
const prescripcion = PrescripcionSchema.parse({
  nombre: "Torso",
  ejercicios: [
    {
      id: serie(1),
      ejercicioId: serie(1),
      nombre: "Press",
      indicaciones: null,
      series: [
        { id: serie(2), tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 },
        { id: serie(3), tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 },
      ],
    },
    {
      id: serie(4),
      ejercicioId: serie(4),
      nombre: "Plancha",
      indicaciones: "Sin carga",
      series: [{ id: serie(5), tipoMedicion: "tiempo", pesoKg: null, segundos: 45 }],
    },
  ],
})
const enviadoEn = new Date("2026-09-14T10:00:00.000Z")

describe("Resultado publicado a partir del registro", () => {
  it("publica cada serie prevista, en orden, con lo realmente hecho", () => {
    const resultado = construirResultado(
      serie(9),
      prescripcion,
      3,
      {
        notas: "Bien",
        series: [
          { serieId: serie(5), tipoMedicion: "tiempo", pesoKg: null, segundos: 50, hecha: true },
          {
            serieId: serie(2),
            tipoMedicion: "repeticiones",
            pesoKg: 42.5,
            repeticiones: 8,
            hecha: true,
          },
        ],
      },
      enviadoEn,
    )
    expect(resultado.series).toEqual([
      {
        serieId: serie(2),
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 42.5, repeticiones: 8 },
      },
      { serieId: serie(3), hecha: false },
      {
        serieId: serie(5),
        hecha: true,
        valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 50 },
      },
    ])
    expect(resultado).toMatchObject({
      revisionPrescripcion: 3,
      notas: "Bien",
      enviadoEn: enviadoEn.toISOString(),
    })
  })

  it("una serie sin marcar no publica sus valores aunque estén escritos", () => {
    const resultado = construirResultado(
      serie(9),
      prescripcion,
      0,
      {
        notas: null,
        series: [
          {
            serieId: serie(2),
            tipoMedicion: "repeticiones",
            pesoKg: 40,
            repeticiones: 10,
            hecha: true,
          },
          {
            serieId: serie(3),
            tipoMedicion: "repeticiones",
            pesoKg: 987.5,
            repeticiones: 977,
            hecha: false,
          },
        ],
      },
      enviadoEn,
    )
    expect(resultado.series[1]).toEqual({ serieId: serie(3), hecha: false })
    expect(JSON.stringify(resultado)).not.toContain("987.5")
    expect(JSON.stringify(resultado)).not.toContain(":977")
  })

  it("no hay resultado sin al menos una serie hecha", () => {
    expect(() =>
      construirResultado(serie(9), prescripcion, 0, { notas: null, series: [] }, enviadoEn),
    ).toThrow()
  })
})
