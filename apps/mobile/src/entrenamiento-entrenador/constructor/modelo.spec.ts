import { describe, expect, it } from "@jest/globals"

import {
  aSesionEnRutina,
  desdeSesionEnRutina,
  faltaEnDia,
  leerRango,
  nuevoDia,
  nuevoEjercicio,
  resumenDeSeccion,
} from "./modelo"

let n = 0
const nuevoId = (): string => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`
const BANCA = { id: "10000000-0000-4000-8000-000000000001", nombre: "Press banca con barra" }
const TIJERAS = { id: "10000000-0000-4000-8000-000000000002", nombre: "Tijeras" }

describe("constructor de planes", () => {
  it("lee rangos como los escribe el entrenador", () => {
    expect(leerRango("8–10")).toEqual({ min: 8, max: 10 })
    expect(leerRango("8-10")).toEqual({ min: 8, max: 10 })
    expect(leerRango("6")).toEqual({ min: 6, max: 6 })
    expect(leerRango("10–8")).toBeNull()
    expect(leerRango("seis")).toBeNull()
  })

  it("la fila de la tabla se convierte en series y vuelve igual", () => {
    const dia = nuevoDia(nuevoId, 1)
    dia.nombre = "Empuje"
    dia.duracion = "100–115 min"
    dia.partes.fuerza = "70–85"
    dia.circuito = { nombre: "Core", vueltas: "2", descanso: "60–90 s" }
    dia.ejercicios = [
      {
        ...nuevoEjercicio(BANCA, "principal", nuevoId),
        series: "4",
        objetivo: "6",
        rir: "3",
        descanso: "2–3 min",
        carga: "60",
        calibrar: false,
        subida: "2,5",
        compuesto: true,
        nota: "Orientativo: 60 kg para 4 × 6.",
        alternativas: "Press en multipower\nPress con mancuernas",
      },
      { ...nuevoEjercicio(TIJERAS, "circuito", nuevoId), dosis: "20", objetivo: "20" },
    ]
    const sesion = aSesionEnRutina(dia, nuevoId)
    const banca = sesion.ejercicios[0]!
    expect(banca.series).toHaveLength(4)
    expect(banca.series[0]).toEqual(
      expect.objectContaining({ tipoMedicion: "repeticiones", repeticiones: 6, pesoKg: 60 }),
    )
    expect(banca).toEqual(
      expect.objectContaining({
        rir: { min: 3, max: 3 },
        descanso: "2–3 min",
        subidaKg: 2.5,
        compuesto: true,
        alternativas: ["Press en multipower", "Press con mancuernas"],
      }),
    )
    expect(sesion.circuito).toEqual({ nombre: "Core", vueltas: 2, descanso: "60–90 s" })
    // Una serie por vuelta del circuito.
    expect(sesion.ejercicios[1]!.series).toHaveLength(2)

    const vuelta = desdeSesionEnRutina(sesion, {
      [BANCA.id]: BANCA.nombre,
      [TIJERAS.id]: "Tijeras",
    })
    expect(vuelta.ejercicios[0]).toEqual(
      expect.objectContaining({ series: "4", objetivo: "6", rir: "3", carga: "60", subida: "2,5" }),
    )
    // Volver a guardar conserva los ids de las series.
    expect(aSesionEnRutina(vuelta, nuevoId).ejercicios[0]!.series.map((s) => s.id)).toEqual(
      banca.series.map((s) => s.id),
    )
  })

  it("con «Calibrar» no hay carga y el rango llega a las series", () => {
    const dia = nuevoDia(nuevoId)
    dia.nombre = "Empuje"
    dia.ejercicios = [{ ...nuevoEjercicio(BANCA, "principal", nuevoId), carga: "40" }]
    const serie = aSesionEnRutina(dia, nuevoId).ejercicios[0]!.series[0]!
    expect(serie).toEqual(
      expect.objectContaining({ pesoKg: null, repeticiones: 8, repeticionesMax: 10 }),
    )
  })

  it("explica qué falta antes de publicar", () => {
    const dia = nuevoDia(nuevoId)
    expect(faltaEnDia(dia)).toMatch(/nombre/)
    dia.nombre = "Empuje"
    expect(faltaEnDia(dia)).toMatch(/al menos un ejercicio/)
    dia.ejercicios = [{ ...nuevoEjercicio(BANCA, "principal", nuevoId), rir: "7" }]
    expect(faltaEnDia(dia)).toMatch(/RIR va de 0 a 5/)
    dia.ejercicios = [nuevoEjercicio(TIJERAS, "circuito", nuevoId)]
    expect(faltaEnDia(dia)).toMatch(/vueltas/)
  })

  it("resume cada parte como en el diseño", () => {
    const dia = nuevoDia(nuevoId)
    dia.circuito.vueltas = "2"
    dia.ejercicios = [
      { ...nuevoEjercicio(BANCA, "principal", nuevoId), series: "4" },
      { ...nuevoEjercicio(BANCA, "principal", nuevoId), series: "3" },
      nuevoEjercicio(TIJERAS, "circuito", nuevoId),
    ]
    expect(resumenDeSeccion(dia, "principal")).toBe("2 ejercicios · 7 series")
    expect(resumenDeSeccion(dia, "circuito")).toBe("1 ejercicio · 2 vueltas")
  })
})
