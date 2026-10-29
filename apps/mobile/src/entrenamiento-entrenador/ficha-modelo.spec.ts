import { describe, expect, it } from "@jest/globals"
import {
  ResultadoEntrenamientoSchema,
  SeriePrescritaDistanciaSchema,
  ValoresEjecutadosDistanciaSchema,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"

import type { ResultadoConDistancia } from "../entrenamiento/resultado"
import {
  edicionDesdeResultado,
  filasDeSesion,
  hechoLegible,
  resumenDeResultado,
  senalesDeVolumen,
} from "./ficha-modelo"

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const serie = (
  n: number,
  pesoKg: number | null,
  repeticiones: number,
  repeticionesMax?: number,
) => ({
  id: u(n),
  tipoMedicion: "repeticiones" as const,
  pesoKg,
  repeticiones,
  ...(repeticionesMax !== undefined && { repeticionesMax }),
})
const hecha = (n: number, pesoKg: number | null, repeticiones: number, rir: number) => ({
  serieId: u(n),
  hecha: true as const,
  valores: { tipoMedicion: "repeticiones" as const, pesoKg, repeticiones, rir },
})

function resultado(extra: Partial<ResultadoEntrenamiento> = {}): ResultadoEntrenamiento {
  return ResultadoEntrenamientoSchema.parse({
    sesionId: u(90),
    revisionPrescripcion: 0,
    enviadoEn: "2026-09-28T19:08:00.000Z",
    notas: "",
    inicio: "2026-09-28T17:30:00.000Z",
    checkin: { sensacion: 4, molestia: "nada" },
    cierre: { esfuerzo: 7, energia: 3, incomodo: false },
    prescripcion: {
      nombre: "Empuje",
      ejercicios: [
        {
          id: u(1),
          ejercicioId: u(101),
          nombre: "Press banca con barra",
          indicaciones: null,
          rir: { min: 3, max: 3 },
          subidaKg: 2.5,
          series: [11, 12, 13, 14].map((n) => serie(n, 67.5, 6)),
        },
        {
          id: u(2),
          ejercicioId: u(102),
          nombre: "Press inclinado con mancuernas",
          indicaciones: null,
          rir: { min: 2, max: 3 },
          series: [21, 22, 23].map((n) => serie(n, 26, 8, 10)),
        },
        {
          id: u(3),
          ejercicioId: u(103),
          nombre: "Cinta inclinada",
          indicaciones: null,
          seccion: "final",
          dosis: "15 min · RPE 5–6",
          series: [{ id: u(31), tipoMedicion: "tiempo", pesoKg: null, segundos: 900 }],
        },
      ],
    },
    series: [
      hecha(11, 67.5, 6, 3),
      hecha(12, 67.5, 6, 2),
      hecha(13, 67.5, 6, 3),
      hecha(14, 67.5, 6, 3),
      hecha(21, 26, 10, 3),
      hecha(22, 26, 9, 2),
      hecha(23, 22, 10, 3),
      { serieId: u(31), hecha: false },
    ],
    ...extra,
  })
}

describe("tabla de la sesión", () => {
  it("prescrito, sugerido, hecho, RIR y próxima vez como en el diseño", () => {
    const [banca, inclinado, cinta] = filasDeSesion(resultado(), new Set([u(2)]))
    expect(banca).toEqual(
      expect.objectContaining({
        prescrito: "4 × 6 · RIR 3",
        sugerido: "67,5 kg",
        hecho: "67,5 × 6, 6, 6, 6",
        rir: "3, 2, 3, 3",
        proxima: expect.objectContaining({ texto: "67,5 kg, igual", tipo: "igual" }),
      }),
    )
    expect(inclinado).toEqual(
      expect.objectContaining({
        prescrito: "3 × 8–10 · RIR 2–3",
        hecho: "26 × 10, 9 · 22 × 10",
        conMolestia: true,
        proxima: expect.objectContaining({ tipo: "revision" }),
      }),
    )
    expect(cinta).toEqual(
      expect.objectContaining({ prescrito: "15 min · RPE 5–6", hecho: "Quitada", proxima: null }),
    )
  })

  it("resumen: duración, RPE y series de trabajo", () => {
    expect(resumenDeResultado(resultado())).toBe("1 h 38 min · RPE 7 · 7 de 7 series")
    expect(hechoLegible([])).toBe("Quitada")
    // Enviada días después de empezar: la duración no es real y no se enseña.
    expect(resumenDeResultado(resultado({ inicio: "2026-09-21T17:30:00.000Z" }))).toBe(
      "RPE 7 · 7 de 7 series",
    )
  })

  it.each([
    ["2026-09-28T17:30:00.000Z", 1800, "30 min"],
    ["2026-09-21T17:30:00.000Z", 3600, "1 h 0 min"],
    [null, 0, "0 min"],
  ])("prioriza la duración activa aunque inicio sea %s", (inicio, segundos, esperado) => {
    expect(resumenDeResultado(resultado({ inicio, tiempoActivoSegundos: segundos }))).toBe(
      `${esperado} · RPE 7 · 7 de 7 series`,
    )
  })
})

describe("señales para bajar volumen", () => {
  it("cuenta molestias, cansancio, esfuerzo y RIR por debajo", () => {
    const cansado = resultado({ checkin: { sensacion: 2, molestia: "agujetas" } })
    const senales = senalesDeVolumen([cansado, cansado], [])
    expect(senales.filter((s) => s.cumple).map((s) => s.texto)).toEqual([
      "Llega cansado a dos sesiones («¿Cómo llegas?» de 2 o menos)",
    ])
    expect(senalesDeVolumen([resultado()], []).every((s) => !s.cumple)).toBe(true)
  })
})

describe("Distancia en metros (D01, aún sin publicar)", () => {
  const enMetros = (n: number, pesoKg: number | null, metros: number) =>
    SeriePrescritaDistanciaSchema.parse({ id: u(n), tipoMedicion: "distancia", pesoKg, metros })
  const recorrida = (n: number, pesoKg: number | null, metros: number, rir?: number) => ({
    serieId: u(n),
    hecha: true as const,
    valores: ValoresEjecutadosDistanciaSchema.parse({
      tipoMedicion: "distancia",
      pesoKg,
      metros,
      ...(rir !== undefined && { rir }),
    }),
  })
  // Datos sintéticos: un transporte con carga, otro sin ella y una serie de repeticiones.
  const conTransportes = (): ResultadoConDistancia => ({
    ...resultado(),
    prescripcion: {
      nombre: "Tracción",
      ejercicios: [
        {
          id: u(4),
          ejercicioId: u(104),
          nombre: "Paseo del granjero",
          indicaciones: null,
          tipoCarga: "conCargaExterna",
          rir: { min: 2, max: 3 },
          series: [enMetros(41, 32, 20), enMetros(42, 32, 20)],
        },
        {
          id: u(5),
          ejercicioId: u(105),
          nombre: "Zancadas caminando",
          indicaciones: null,
          seccion: "final",
          tipoCarga: "sinCarga",
          series: [enMetros(51, null, 30)],
        },
        {
          id: u(1),
          ejercicioId: u(101),
          nombre: "Press banca con barra",
          indicaciones: null,
          series: [serie(11, 67.5, 6)],
        },
      ],
    },
    series: [
      recorrida(41, 32, 20, 2),
      recorrida(42, 34, 18),
      recorrida(51, null, 30),
      hecha(11, 67.5, 6, 3),
    ],
  })

  it("la tabla muestra objetivo y hecho en metros, con kilos solo si los lleva", () => {
    const [granjero, zancadas, banca] = filasDeSesion(conTransportes(), new Set())
    expect(granjero).toEqual(
      expect.objectContaining({
        prescrito: "2 × 20 m · RIR 2–3",
        sugerido: "32 kg",
        hecho: "32 × 20 m · 34 × 18 m",
        rir: "2",
      }),
    )
    expect(zancadas).toEqual(
      expect.objectContaining({ prescrito: "30 m", sugerido: "—", hecho: "30 m", proxima: null }),
    )
    // La serie de repeticiones se lee igual que antes.
    expect(banca).toEqual(expect.objectContaining({ prescrito: "1 × 6", hecho: "67,5 × 6" }))
  })

  it("«La próxima vez» recibe los metros como metros, nunca como repeticiones", () => {
    expect(edicionDesdeResultado(conTransportes()).series).toEqual([
      { serieId: u(41), hecha: true, peso: "32", valor: "20", rir: 2 },
      { serieId: u(42), hecha: true, peso: "34", valor: "18", rir: null },
      { serieId: u(51), hecha: true, peso: "", valor: "30", rir: null },
      { serieId: u(11), hecha: true, peso: "67,5", valor: "6", rir: 3 },
    ])
  })

  it("«Hecho» nombra cada unidad y no confunde metros con segundos", () => {
    expect(
      hechoLegible([
        { tipoMedicion: "distancia", pesoKg: null, metros: 30 },
        { tipoMedicion: "distancia", pesoKg: null, metros: 25 },
      ]),
    ).toBe("30 m, 25 m")
    expect(
      hechoLegible([
        { tipoMedicion: "tiempo", pesoKg: null, segundos: 40 },
        { tipoMedicion: "distancia", pesoKg: null, metros: 40 },
      ]),
    ).toBe("40 s, 40 m")
  })
})
