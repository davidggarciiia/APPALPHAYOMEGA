import { describe, expect, it } from "@jest/globals"
import { CONFIGURACION_SEGUIMIENTO_INICIAL } from "@alpha-omega/shared"

import {
  edadEn,
  leerDecimal,
  leerSueno,
  masaLibre,
  media,
  mediaMovil,
  miles,
  pesoLegible,
  proximosRegistros,
  resumenDeSemana,
  sentidoDelPeso,
  suenoLegible,
} from "./modelo"

const dia = (
  fecha: string,
  pesoKg: number | null,
  pasos: number | null = null,
  suenoMin: number | null = null,
) => ({
  fecha,
  pesoKg,
  pasos,
  suenoMin,
  creatina: null,
  suplementos: [],
})

describe("formatos del diseño", () => {
  it("«111,6 kg», «3.240» y «7 h 40»", () => {
    expect(pesoLegible(111.6)).toBe("111,6 kg")
    expect(pesoLegible(112)).toBe("112,0 kg")
    expect(miles(3240)).toBe("3.240")
    expect(miles(12480)).toBe("12.480")
    expect(miles(980)).toBe("980")
    expect(suenoLegible(460)).toBe("7 h 40")
    expect(suenoLegible(485)).toBe("8 h 05")
  })

  it("lee lo que escribe el cliente", () => {
    expect(leerDecimal("111,6")).toBe(111.6)
    expect(leerDecimal(" 80 ")).toBe(80)
    expect(leerDecimal("")).toBeNull()
    expect(leerDecimal("abc")).toBeNaN()
    expect(leerSueno("7:40")).toBe(460)
    expect(leerSueno("7 h 40")).toBe(460)
    expect(leerSueno("7,5")).toBe(450)
    expect(leerSueno("8")).toBe(480)
    expect(leerSueno("")).toBeNull()
    expect(leerSueno("siete")).toBeNaN()
  })
})

describe("cálculos", () => {
  it("calcula el siguiente registro diario o semanal sin repetir el de hoy", () => {
    const config = {
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      registrosSolicitados: [
        { indicador: "peso" as const, frecuencia: "diaria" as const, diaSemana: null },
        { indicador: "pasos" as const, frecuencia: "diaria" as const, diaSemana: null },
        { indicador: "cintura" as const, frecuencia: "semanal" as const, diaSemana: 1 },
      ],
    }
    expect(proximosRegistros(config, [dia("2026-09-24", 81, null)], [], "2026-09-24")).toEqual([
      { indicador: "pasos", fecha: "2026-09-24" },
      { indicador: "peso", fecha: "2026-09-25" },
      { indicador: "cintura", fecha: "2026-09-28" },
    ])
  })

  it("deja neutral el peso sin objetivo e interpreta dirección y rango pautados", () => {
    expect(sentidoDelPeso(null, 90, 88)).toBe("neutral")
    const bajar = { direccion: "bajar" as const, rangoKg: { minimo: 80, maximo: 85 } }
    expect(sentidoDelPeso(bajar, 90, 88)).toBe("favorable")
    expect(sentidoDelPeso(bajar, 90, 79)).toBe("desfavorable")
    expect(
      sentidoDelPeso({ direccion: "mantener", rangoKg: { minimo: 80, maximo: 85 } }, 82, 83),
    ).toBe("favorable")
  })
  it("media con un decimal, ignorando días sin dato", () => {
    expect(media([112.1, 112.1, 112.3, null])).toBe(112.2)
    expect(media([null])).toBeNull()
  })

  it("media móvil de 7 días por fecha", () => {
    const dias = [
      dia("2026-09-21", 112.1),
      dia("2026-09-22", 112.1),
      dia("2026-09-23", 112.3),
      dia("2026-09-29", 111.0),
    ]
    expect(mediaMovil(dias, 7)).toEqual([
      { fecha: "2026-09-21", valor: 112.1 },
      { fecha: "2026-09-22", valor: 112.1 },
      { fecha: "2026-09-23", valor: 112.2 },
      // El 29 ya no ve el 21 ni el 22: solo el 23 y el 29.
      { fecha: "2026-09-29", valor: 111.7 },
    ])
  })

  it("resumen de la semana: peso medio, pasos y sueño medios", () => {
    const dias = [
      dia("2026-09-21", 112.1, 6000, 480),
      dia("2026-09-22", 111.9, 7000, 490),
      dia("2026-09-28", 110, 1000, 300),
    ]
    expect(resumenDeSemana(dias, "2026-09-21")).toEqual({
      pesoKg: 112,
      pasos: 6500,
      suenoMin: 485,
    })
  })

  it("masa libre de grasa y edad", () => {
    expect(masaLibre(112.2, 29.2)).toBe(79.4)
    expect(edadEn("2005-03-10", "2026-09-24")).toBe(21)
    expect(edadEn("2005-10-10", "2026-09-24")).toBe(20)
  })
})
