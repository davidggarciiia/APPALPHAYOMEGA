import { describe, expect, it } from "@jest/globals"
import { metabolismoBasal } from "@alpha-omega/shared"

import { aplicarPauta, deficit, gastoTotal, gramosDeMacros, porcentajesDe } from "./calculo"

const DAVID = { pesoKg: 112.2, alturaCm: 196, edad: 21, sexo: "hombre" as const }

describe("cálculo del gasto, con las cifras del diseño", () => {
  it("Mifflin-St Jeor: 2.247 kcal; por 1,55: 3.483 kcal", () => {
    expect(metabolismoBasal(DAVID)).toBe(2247)
    expect(metabolismoBasal({ ...DAVID, sexo: "mujer" })).toBe(2081)
    expect(gastoTotal(2247, 1.55)).toBe(3483)
  })

  it("3.250 kcal frente a 3.483: déficit de unos 230 kcal, un 7 %", () => {
    expect(deficit(3250, 3483)).toEqual({ kcal: 233, pct: 7 })
    expect(deficit(3600, 3483)).toEqual({ kcal: -117, pct: -3 })
  })

  it("45 / 25 / 30 % de 3.250 kcal: 366 g, 203 g y 108 g", () => {
    expect(gramosDeMacros(3250, { hidratos: 45, proteina: 25, grasas: 30 })).toEqual({
      hidratosG: 366,
      proteinaG: 203,
      grasaG: 108,
    })
    expect(porcentajesDe({ kcal: 3250, hidratosG: 366, proteinaG: 203, grasaG: 108 })).toEqual({
      hidratos: 45,
      proteina: 25,
      grasas: 30,
    })
  })
})

describe("aplicar la pauta a la dieta", () => {
  const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  const pauta = {
    objetivo: { kcal: 3250, hidratosG: 366, proteinaG: 203, grasaG: 108 },
    margenKcal: 100,
    suplementos: [{ nombre: "Creatina monohidrato", dosis: "3–5 g al día" }],
    registroComidas: true,
    pesoDiario: true,
    nota: "Mantén la proteína alta.",
    calculo: { ...DAVID, grasaPct: 29.2, factorActividad: 1.55, nota: null },
  }

  it("sin dieta crea una de objetivos para todos los días", () => {
    const documento = aplicarPauta(null, pauta, () => u(1))
    expect(documento.tiposDeDia).toEqual([
      expect.objectContaining({ id: u(1), nombre: "Todos los días", comidas: [], margenKcal: 100 }),
    ])
    expect(documento.semana).toEqual(Array(7).fill(u(1)))
    expect(documento.indicaciones).toEqual([
      { titulo: "Peso en ayunas", texto: "cada día, al levantarte" },
    ])
  })

  it("con dieta cambia el objetivo de cada día y conserva sus comidas y pautas", () => {
    const base = aplicarPauta(null, pauta, () => u(1))
    const conPautas = {
      ...base,
      indicaciones: [{ titulo: "Plancha", texto: "u horno" }, ...base.indicaciones],
    }
    const nueva = aplicarPauta(conPautas, { ...pauta, pesoDiario: false, margenKcal: 150 }, () =>
      u(2),
    )
    expect(nueva.tiposDeDia[0]!.margenKcal).toBe(150)
    expect(nueva.indicaciones).toEqual([{ titulo: "Plancha", texto: "u horno" }])
    expect(nueva.nota).toBe("Mantén la proteína alta.")
  })
})
