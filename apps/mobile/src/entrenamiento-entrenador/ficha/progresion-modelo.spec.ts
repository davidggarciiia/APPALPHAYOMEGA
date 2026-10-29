import type { ListadoResultados, ProgresionFuerza } from "@alpha-omega/shared"
import { conRirDelHistorial, historialDelEjercicio, semanasDeFuerza } from "./progresion-modelo"

it("agrupa lunes a domingo y elige la mejor serie con la regla de E1, sin inventar semanas", () => {
  const puntos: ProgresionFuerza["ejercicios"][number]["puntos"] = [
    { fecha: "2026-10-26", pesoKg: 60, repeticiones: 10, estimado: 80 },
    { fecha: "2026-10-28", pesoKg: 62.5, repeticiones: 6, estimado: 75 },
    { fecha: "2026-10-18", pesoKg: 57.5, repeticiones: 10, estimado: 76.7 },
  ]
  expect(semanasDeFuerza(puntos)).toMatchObject([
    { semana: "2026-10-12", fecha: "2026-10-18", serie: { pesoKg: 57.5 }, estimado: 76.7 },
    { semana: "2026-10-26", fecha: "2026-10-28", serie: { pesoKg: 62.5 }, estimado: 75 },
  ])
  expect(semanasDeFuerza([])).toEqual([])
})

it("separa cada ejercicio, conserva omitidas, RIR nulo y unidades originales y ordena por fecha de agenda", () => {
  const lista = [
    {
      agenda: { fechaActual: "2026-10-26" },
      resultado: {
        sesionId: "sesion",
        enviadoEn: "2026-10-27T10:00:00Z",
        prescripcion: {
          ejercicios: [
            {
              id: "e",
              ejercicioId: "remo",
              nombre: "Remo",
              series: [
                { id: "a", tipoMedicion: "repeticiones", repeticiones: 8, pesoKg: 60 },
                { id: "b", tipoMedicion: "repeticiones", repeticiones: 8, pesoKg: 60 },
              ],
            },
            {
              id: "t",
              ejercicioId: "plancha",
              series: [{ id: "c", tipoMedicion: "tiempo", segundos: 30, pesoKg: null }],
            },
          ],
        },
        series: [
          {
            serieId: "a",
            hecha: true,
            valores: { tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 10, rir: null },
          },
          { serieId: "b", hecha: false, omitida: true },
          {
            serieId: "c",
            hecha: true,
            valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
          },
        ],
      },
    },
  ] as ListadoResultados["resultados"]
  expect(historialDelEjercicio(lista, "remo")[0]).toMatchObject({
    fecha: "2026-10-26",
    sesionId: "sesion",
    series: [
      { serieId: "a", hecha: true, pesoKg: 60, repeticiones: 10, rir: null },
      { serieId: "b", hecha: false, omitida: true },
    ],
  })
  expect(historialDelEjercicio(lista, "plancha")[0]?.series[0]).toMatchObject({
    tipoMedicion: "tiempo",
    segundos: 30,
  })
  expect(historialDelEjercicio(lista, "ausente")).toEqual([])
  const semanas = semanasDeFuerza([
    { fecha: "2026-10-26", pesoKg: 60, repeticiones: 10, estimado: 80 },
  ])
  expect(conRirDelHistorial(semanas[0], historialDelEjercicio(lista, "remo"))?.rir).toBeNull()
  const principal = lista[0]!.resultado.prescripcion.ejercicios[0]!
  lista[0]!.resultado.prescripcion.ejercicios.unshift({
    ...principal,
    id: "cal",
    seccion: "calentamiento",
    series: [{ id: "d", tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 12 }],
  })
  principal.rir = { min: 2, max: 3 }
  const historial = historialDelEjercicio(lista, "remo")
  expect(historial[0]?.ejercicio.id).toBe("e")
  expect(historial[0]?.rirPorSerie).toEqual({
    a: { min: 2, max: 3 },
    b: { min: 2, max: 3 },
    d: undefined,
  })
  expect(
    semanasDeFuerza(
      [{ fecha: "2026-10-26", pesoKg: 40, repeticiones: 10, estimado: 53.3 }],
      historial,
    )[0]?.serie.pesoKg,
  ).toBe(60)
  expect(
    semanasDeFuerza(
      [{ fecha: "2026-10-26", pesoKg: 80, repeticiones: 8, estimado: 101.3 }],
      historial,
    )[0]?.serie.pesoKg,
  ).toBe(80)
})
