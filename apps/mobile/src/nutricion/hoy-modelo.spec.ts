import { describe, expect, it } from "@jest/globals"
import { ComidaSchema, type Comida, type ComidaRegistrada } from "@alpha-omega/shared"

import { comidaDeAhora, repartoDeMacros, subtituloDeComida, suplementoTomado } from "./hoy-modelo"

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const media = ComidaSchema.parse({
  id: u(1),
  nombre: "Media mañana",
  hora: "11:00",
  indicacion: null,
  forma: "alternativas",
  grupos: [
    {
      nombre: "Dulces",
      alternativas: [
        {
          id: u(11),
          titulo: "Tortitas de avena",
          alimentos: [{ nombre: "Avena", cantidad: "40 g" }],
          nota: null,
          macros: null,
        },
        {
          id: u(12),
          titulo: "Torrijas fit",
          alimentos: [{ nombre: "Pan", cantidad: "55 g" }],
          nota: null,
          macros: null,
        },
      ],
    },
  ],
})
const comida = ComidaSchema.parse({
  id: u(2),
  nombre: "Comida",
  hora: "14:00",
  indicacion: null,
  forma: "intercambio",
  columnas: [{ nombre: "Hidrato", alimentos: [{ nombre: "Arroz blanco", cantidad: "50 g" }] }],
})
const cena: Comida = { ...comida, id: u(3), nombre: "Cena", hora: "21:00" }

const registrada = (eleccion: ComidaRegistrada["eleccion"]): ComidaRegistrada => ({
  fecha: "2026-09-24",
  comidaId: u(1),
  dietaId: u(99),
  eleccion,
  registradaEn: "2026-09-24T09:00:00.000Z",
})

describe("comida de ahora", () => {
  it("la última cuya hora ha llegado y sigue pendiente", () => {
    expect(comidaDeAhora([media, comida, cena], new Set(), "15:10")).toBe(u(2))
    expect(comidaDeAhora([media, comida, cena], new Set([u(2)]), "15:10")).toBe(u(1))
    expect(comidaDeAhora([media, comida, cena], new Set(), "08:00")).toBe(u(1))
    expect(comidaDeAhora([media, comida, cena], new Set([u(1), u(2), u(3)]), "22:00")).toBeNull()
  })
})

describe("subtítulo de una comida", () => {
  it("lo elegido, o qué hay que hacer", () => {
    expect(subtituloDeComida(media, undefined)).toBe("2 opciones")
    expect(
      subtituloDeComida(media, registrada({ tipo: "alternativa", alternativaId: u(12) })),
    ).toBe("Torrijas fit")
    expect(subtituloDeComida(comida, undefined)).toBe("Elige tu plato")
    expect(
      subtituloDeComida(
        comida,
        registrada({ tipo: "plato", elegidos: [{ columna: "Hidrato", alimento: "Arroz blanco" }] }),
      ),
    ).toBe("Arroz blanco")
  })
})

describe("reparto de macros", () => {
  it("porcentaje de las kcal de cada macro, como en el diseño", () => {
    expect(repartoDeMacros({ kcal: 3250, hidratosG: 366, proteinaG: 203, grasaG: 108 })).toEqual([
      { clave: "hidratos", nombre: "Hidratos", gramos: 366, pct: 45 },
      { clave: "proteina", nombre: "Proteína", gramos: 203, pct: 25 },
      { clave: "grasas", nombre: "Grasas", gramos: 108, pct: 30 },
    ])
    expect(repartoDeMacros({ kcal: 2000, hidratosG: null, proteinaG: 150, grasaG: 60 })).toBeNull()
  })
})

describe("suplementos", () => {
  const dia = {
    fecha: "2026-09-24",
    pesoKg: null,
    pasos: null,
    suenoMin: null,
    creatina: true,
    suplementos: ["Omega 3"],
  }
  it("la creatina va en su campo; el resto, por nombre", () => {
    expect(suplementoTomado({ nombre: "Creatina monohidrato", dosis: "3–5 g" }, dia)).toBe(true)
    expect(suplementoTomado({ nombre: "Omega 3", dosis: null }, dia)).toBe(true)
    expect(suplementoTomado({ nombre: "Vitamina D", dosis: null }, dia)).toBe(false)
    expect(suplementoTomado({ nombre: "Omega 3", dosis: null }, null)).toBe(false)
  })
})
