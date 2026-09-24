import { describe, expect, it } from "@jest/globals"
import { ResultadoEntrenamientoSchema, type ResultadoEntrenamiento } from "@alpha-omega/shared"

import { filasDeSesion, hechoLegible, resumenDeResultado, senalesDeVolumen } from "./ficha-modelo"

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
