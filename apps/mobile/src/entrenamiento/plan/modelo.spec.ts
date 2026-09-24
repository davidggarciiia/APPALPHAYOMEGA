import { describe, expect, it } from "@jest/globals"
import { EjercicioPrescritoSchema, type EjercicioPrescrito } from "@alpha-omega/shared"

import {
  detalleDeEjercicio,
  dosisDeEjercicio,
  faseActual,
  fechasDelBloque,
  minutosDeFinal,
  semanaDelBloque,
  textoDeFase,
  textoDeDeporte,
} from "./modelo"

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const reps = (
  n: number,
  repeticiones: number,
  repeticionesMax?: number,
  pesoKg: number | null = 60,
) =>
  ({
    id: u(100 + n),
    tipoMedicion: "repeticiones",
    pesoKg,
    repeticiones,
    ...(repeticionesMax !== undefined && { repeticionesMax }),
  }) as const

function ejercicio(extra: Partial<EjercicioPrescrito>): EjercicioPrescrito {
  return EjercicioPrescritoSchema.parse({
    id: u(1),
    ejercicioId: u(2),
    nombre: "Press banca con barra",
    indicaciones: null,
    series: [reps(1, 6)],
    ...extra,
  })
}

describe("dosis y detalle de un ejercicio", () => {
  it("series iguales: «4×6»; con rango: «3×8–10»", () => {
    expect(dosisDeEjercicio(ejercicio({ series: [1, 2, 3, 4].map((n) => reps(n, 6)) }))).toBe("4×6")
    expect(dosisDeEjercicio(ejercicio({ series: [1, 2, 3].map((n) => reps(n, 8, 10)) }))).toBe(
      "3×8–10",
    )
  })

  it("series distintas se enumeran y el tiempo va en segundos", () => {
    expect(dosisDeEjercicio(ejercicio({ series: [reps(1, 9), reps(2, 8), reps(3, 8)] }))).toBe(
      "9 / 8 / 8",
    )
    expect(
      dosisDeEjercicio(
        ejercicio({ series: [{ id: u(9), tipoMedicion: "tiempo", pesoKg: null, segundos: 40 }] }),
      ),
    ).toBe("40 s")
  })

  it("la dosis escrita por el entrenador manda", () => {
    expect(dosisDeEjercicio(ejercicio({ dosis: "1×8 por lado" }))).toBe("1×8 por lado")
  })

  it("detalle: RIR y descanso", () => {
    expect(detalleDeEjercicio(ejercicio({ rir: { min: 3, max: 3 }, descanso: "2–3 min" }))).toBe(
      "RIR 3 · 2–3 min",
    )
    expect(detalleDeEjercicio(ejercicio({ rir: { min: 2, max: 3 } }))).toBe("RIR 2–3")
    expect(detalleDeEjercicio(ejercicio({}))).toBeNull()
  })
})

describe("bloque", () => {
  const plan = { semanaInicial: "2026-09-21", semanas: 6 }

  it("semana en curso y fechas del bloque", () => {
    expect(semanaDelBloque(plan, "2026-09-28")).toBe(2)
    expect(fechasDelBloque(plan)).toBe("21 sep – 1 nov")
  })

  it("la fase de ahora es la que contiene la semana", () => {
    const fases = [
      { desde: 1, hasta: 2, nombre: "Calibrar", detalle: null },
      { desde: 3, hasta: 4, nombre: "Progresar", detalle: null },
    ]
    expect(faseActual(fases, 2)).toBe(0)
    expect(faseActual(fases, 3)).toBe(1)
    expect(faseActual(fases, 6)).toBe(-1)
    expect(textoDeFase(fases[0]!)).toBe("Semanas 1–2")
    expect(textoDeFase({ desde: 5, hasta: 5, nombre: "Apretar", detalle: null })).toBe("Semana 5")
  })

  it("otro deporte: «K-1: jueves y domingo, 60 min»", () => {
    expect(textoDeDeporte({ nombre: "K-1", dias: [7, 4], minutos: 60 })).toBe(
      "K-1: jueves y domingo, 60 min",
    )
    expect(textoDeDeporte({ nombre: "Pádel", dias: [1, 3, 5], minutos: null })).toBe(
      "Pádel: lunes, miércoles y viernes",
    )
  })

  it("el final suma cardio y calma cuando son minutos exactos", () => {
    expect(minutosDeFinal({ cardio: "15", calma: "5" })).toBe("20")
    expect(minutosDeFinal({ cardio: "15", calma: "5–8" })).toBe("5–8")
    expect(minutosDeFinal({ calma: "5" })).toBe("5")
    expect(minutosDeFinal(undefined)).toBeNull()
  })
})
