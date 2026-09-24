import { describe, expect, it } from "@jest/globals"
import { PrescripcionSchema, type Prescripcion } from "@alpha-omega/shared"

import { desdePrescripcion, type EdicionRegistro } from "../registro-modelo"
import {
  duracionLegible,
  porSecciones,
  proximaVez,
  reloj,
  resumenPrescrito,
  segundosDeDescanso,
  serieEnCurso,
  seriesDeTrabajo,
} from "./modelo"

const u = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const prescripcion: Prescripcion = PrescripcionSchema.parse({
  nombre: "Empuje",
  ejercicios: [
    {
      id: u(1),
      ejercicioId: u(101),
      nombre: "Band pull-apart",
      indicaciones: null,
      seccion: "calentamiento",
      dosis: "2×12",
      series: [{ id: u(11), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 12 }],
    },
    {
      id: u(2),
      ejercicioId: u(102),
      nombre: "Press banca con barra",
      indicaciones: null,
      seccion: "principal",
      rir: { min: 3, max: 3 },
      descanso: "2–3 min",
      subidaKg: 2.5,
      series: [
        { id: u(21), tipoMedicion: "repeticiones", pesoKg: 67.5, repeticiones: 6 },
        { id: u(22), tipoMedicion: "repeticiones", pesoKg: 67.5, repeticiones: 6 },
      ],
    },
    {
      id: u(3),
      ejercicioId: u(103),
      nombre: "Press inclinado con mancuernas",
      indicaciones: null,
      rir: { min: 2, max: 3 },
      descanso: "2 min",
      series: [
        {
          id: u(31),
          tipoMedicion: "repeticiones",
          pesoKg: 26,
          repeticiones: 8,
          repeticionesMax: 10,
        },
      ],
    },
    {
      id: u(4),
      ejercicioId: u(104),
      nombre: "Press de hombro en máquina",
      indicaciones: null,
      calibrar: true,
      series: [{ id: u(41), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 12 }],
    },
  ],
})

function edicion(
  cambios: Record<string, Partial<EdicionRegistro["series"][number]>>,
): EdicionRegistro {
  const base = desdePrescripcion(prescripcion)
  return {
    ...base,
    series: base.series.map((s) => ({ ...s, ...(cambios[s.serieId] ?? {}) })),
  }
}

describe("Lógica de la sesión en curso", () => {
  it("lee el descanso del texto del entrenador", () => {
    expect(segundosDeDescanso("2–3 min")).toBe(120)
    expect(segundosDeDescanso("90–120 s")).toBe(90)
    expect(segundosDeDescanso("1:30")).toBe(90)
    expect(segundosDeDescanso("1,5 min")).toBe(90)
    expect(segundosDeDescanso(undefined)).toBeNull()
    expect(segundosDeDescanso("cuando puedas")).toBeNull()
  })

  it("pinta el cronómetro y la duración", () => {
    expect(reloj(2052)).toBe("34:12")
    expect(reloj(3725)).toBe("1:02:05")
    expect(duracionLegible("2026-09-24T10:00:00.000Z", new Date("2026-09-24T11:38:00.000Z"))).toBe(
      "1 h 38 min",
    )
    expect(duracionLegible("2026-09-24T10:00:00.000Z", new Date("2026-09-24T10:45:00.000Z"))).toBe(
      "45 min",
    )
  })

  it("resume cada ejercicio como en el diseño", () => {
    expect(resumenPrescrito(prescripcion.ejercicios[1]!)).toBe("2 × 6 · RIR 3 · 2–3 min")
    expect(resumenPrescrito(prescripcion.ejercicios[2]!)).toBe("1 × 8–10 · RIR 2–3 · 2 min")
  })

  it("agrupa por partes y cuenta solo las series de trabajo", () => {
    expect(porSecciones(prescripcion).map((s) => [s.seccion, s.ejercicios.length])).toEqual([
      ["calentamiento", 1],
      ["principal", 3],
    ])
    expect(seriesDeTrabajo(prescripcion)).toEqual([u(21), u(22), u(31), u(41)])
  })

  it("el progreso cuenta la parte principal; el circuito sigue marcando la serie en curso", () => {
    const conCircuito = PrescripcionSchema.parse({
      ...prescripcion,
      circuito: { vueltas: 2 },
      ejercicios: [
        ...prescripcion.ejercicios,
        {
          id: u(5),
          ejercicioId: u(105),
          nombre: "Tijeras",
          indicaciones: null,
          seccion: "circuito",
          series: [{ id: u(51), tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 20 }],
        },
      ],
    })
    expect(seriesDeTrabajo(conCircuito)).toEqual([u(21), u(22), u(31), u(41)])
    const todoPrincipal = Object.fromEntries(
      [u(21), u(22), u(31), u(41)].map((id) => [id, { hecha: true }]),
    )
    expect(serieEnCurso(conCircuito, edicion(todoPrincipal))).toBe(u(51))
  })

  it("la serie en curso es la primera de trabajo sin hacer", () => {
    expect(serieEnCurso(prescripcion, edicion({}))).toBe(u(21))
    expect(serieEnCurso(prescripcion, edicion({ [u(21)]: { hecha: true } }))).toBe(u(22))
  })

  it("«La próxima vez» sube, mantiene, toma referencia o deja en revisión", () => {
    const hecho = (peso: string, valor: string, rir: number) => ({ hecha: true, peso, valor, rir })
    const resultado = proximaVez(
      prescripcion,
      edicion({
        [u(21)]: hecho("67,5", "6", 3),
        [u(22)]: hecho("67,5", "6", 3),
        [u(31)]: hecho("26", "10", 2),
        [u(41)]: hecho("45", "12", 2),
      }),
      new Set([u(3)]),
    )
    expect(resultado.map((r) => [r.nombre, r.texto, r.tipo])).toEqual([
      ["Press banca con barra", "Sube a 70 kg", "sube"],
      ["Press inclinado con mancuernas", "En revisión", "revision"],
      ["Press de hombro en máquina", "Referencia 45 kg", "referencia"],
    ])
  })

  it("con RIR 1 o sin llegar al tope no se sube", () => {
    const resultado = proximaVez(
      prescripcion,
      edicion({
        [u(21)]: { hecha: true, peso: "67,5", valor: "6", rir: 1 },
        [u(22)]: { hecha: true, peso: "67,5", valor: "6", rir: 3 },
        [u(31)]: { hecha: true, peso: "26", valor: "9", rir: 2 },
      }),
      new Set(),
    )
    expect(resultado.map((r) => r.texto)).toEqual(["67,5 kg, igual", "26 kg, igual"])
  })
})
