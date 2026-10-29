import type { ListadoResultados, ProgresionFuerza } from "@alpha-omega/shared"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  conRirDelHistorial,
  historialDelEjercicio,
  semanasDeFuerza,
  type SesionDelEjercicio,
} from "./progresion-modelo"

it("la ficha, su progresión y la revisión profesional no recomiendan subir cargas", () => {
  const fuentes = (directorio: string): string[] =>
    readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
      const ruta = join(directorio, entrada.name)
      return entrada.isDirectory()
        ? fuentes(ruta)
        : /\.tsx?$/.test(ruta) && !ruta.includes(".spec.")
          ? [ruta]
          : []
    })
  const archivos = [...fuentes(__dirname), join(__dirname, "..", "ejercicios-revision.tsx")]
  expect(archivos.length).toBeGreaterThan(5)
  expect(
    archivos.filter((ruta) =>
      /sube\s+(?:la\s+)?carga|próxima vez/iu.test(readFileSync(ruta, "utf8")),
    ),
  ).toEqual([])
})

// Sustituye «agrupa lunes a domingo y elige la mejor serie por Epley, sin inventar semanas».
it("agrupa lunes a domingo y elige más kg y después reps como E1, sin inventar semanas", () => {
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

it("el empate del mismo día conserva el RIR de la primera sesión cronológica como E1", () => {
  const historial = [15, 12].map((hora) => ({
    sesionId: `sesion-${hora}`,
    fecha: "2026-10-26",
    enviadoEn: `2026-10-26T${hora}:00:00Z`,
    series: [
      {
        serieId: `serie-${hora}`,
        hecha: true,
        tipoMedicion: "repeticiones",
        pesoKg: 60,
        repeticiones: 10,
        rir: hora === 12 ? 1 : 4,
      },
    ],
  })) as SesionDelEjercicio[]
  const semana = semanasDeFuerza(
    [{ fecha: "2026-10-26", pesoKg: 60, repeticiones: 10, estimado: 80 }],
    historial,
  )[0]
  expect(conRirDelHistorial(semana, historial)?.rir).toBe(1)
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
  })
  expect(historial[0]?.series.map((s) => s.serieId)).toEqual(["a", "b"])
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

it.each(["calentamiento", "circuito", "final"] as const)(
  "excluye %s y sus aproximaciones del historial aunque haya kilos registrados",
  (seccion) => {
    const resultados = [
      {
        agenda: { fechaActual: "2026-10-26" },
        resultado: {
          sesionId: "sesion",
          enviadoEn: "2026-10-26T12:00:00Z",
          prescripcion: {
            ejercicios: [
              {
                id: "aproximacion",
                ejercicioId: "press",
                nombre: "Aproximaciones",
                seccion,
                series: [
                  { id: "serie", tipoMedicion: "repeticiones", pesoKg: 100, repeticiones: 10 },
                ],
              },
            ],
          },
          series: [
            {
              serieId: "serie",
              hecha: true,
              valores: { tipoMedicion: "repeticiones", pesoKg: 100, repeticiones: 10 },
            },
          ],
        },
      },
    ] as ListadoResultados["resultados"]
    expect(historialDelEjercicio(resultados, "press")).toEqual([])
  },
)
