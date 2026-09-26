import { describe, expect, it } from "@jest/globals"
import { PrescripcionSchema, type Prescripcion } from "@alpha-omega/shared"

import {
  desdePrescripcion,
  type EdicionRegistro,
  type EjercicioConDistancia,
  type PrescripcionConDistancia,
} from "../registro-modelo"
import {
  duracionLegible,
  objetivoDeSerie,
  porSecciones,
  proximaVez,
  reloj,
  resumenPrescrito,
  segundosDeDescanso,
  serieEnCurso,
  ejercicioEnCurso,
  ejercicioParaRirFinal,
  estadoDeEjercicio,
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
  it("mantiene el ejercicio terminado a la vista hasta responder o saltar el RIR final", () => {
    const conRirFinal = PrescripcionSchema.parse({
      ...prescripcion,
      ejercicios: prescripcion.ejercicios.map((ejercicio) =>
        ejercicio.id === u(2) ? { ...ejercicio, modoRir: "alFinalizarEjercicio" } : ejercicio,
      ),
    })
    const anterior = desdePrescripcion(conRirFinal)
    const primera = {
      ...anterior,
      series: anterior.series.map((serie) =>
        serie.serieId === u(21) ? { ...serie, hecha: true, valor: "6", peso: "67,5" } : serie,
      ),
    }
    expect(ejercicioParaRirFinal(conRirFinal, primera, u(21))).toBeNull()
    const resuelto = {
      ...primera,
      series: primera.series.map((serie) =>
        serie.serieId === u(22) ? { ...serie, hecha: true, valor: "6", peso: "67,5" } : serie,
      ),
    }
    expect(ejercicioParaRirFinal(conRirFinal, resuelto, u(22))).toBe(u(2))
  })
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
    expect(serieEnCurso(conCircuito, edicion({ ...todoPrincipal, [u(11)]: { hecha: true } }))).toBe(
      u(51),
    )
  })

  it("guía por calentamiento y trabajo, y salta las series omitidas", () => {
    expect(serieEnCurso(prescripcion, edicion({}))).toBe(u(11))
    expect(ejercicioEnCurso(prescripcion, edicion({}))?.id).toBe(u(1))
    const registro = edicion({ [u(11)]: { hecha: true }, [u(21)]: { omitida: true } })
    expect(serieEnCurso(prescripcion, registro)).toBe(u(22))
    expect(ejercicioEnCurso(prescripcion, registro)?.id).toBe(u(2))
    expect(estadoDeEjercicio(prescripcion.ejercicios[1]!, registro)).toBe("enCurso")
    expect(estadoDeEjercicio(prescripcion.ejercicios[0]!, registro)).toBe("hecho")
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

describe("Distancia en metros (D01, aún sin publicar)", () => {
  const transporte: EjercicioConDistancia = {
    id: u(6),
    ejercicioId: u(106),
    nombre: "Paseo del granjero",
    indicaciones: null,
    tipoCarga: "conCargaExterna",
    rir: { min: 2, max: 3 },
    descanso: "90 s",
    subidaKg: 2,
    series: [
      { id: u(61), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
      { id: u(62), tipoMedicion: "distancia", pesoKg: 32, metros: 20 },
    ],
  }
  const conTransporte: PrescripcionConDistancia = {
    ...prescripcion,
    ejercicios: [...prescripcion.ejercicios, transporte],
  }
  function conMetros(
    cambios: Record<string, Partial<EdicionRegistro["series"][number]>>,
  ): EdicionRegistro {
    const base = desdePrescripcion(conTransporte)
    return {
      ...base,
      series: base.series.map((s) => ({ ...s, ...(cambios[s.serieId] ?? {}) })),
    }
  }

  it("pauta los metros como metros, sin rango ni repeticiones, con el descanso escrito", () => {
    expect(objetivoDeSerie(transporte.series[0]!)).toBe("20 m")
    expect(resumenPrescrito(transporte)).toBe("2 × 20 m · RIR 2–3 · 90 s")
    // El descanso sale del texto del entrenador, nunca de los metros.
    expect(segundosDeDescanso(transporte.descanso)).toBe(90)
    // Las series anteriores se leen igual.
    expect(objetivoDeSerie(prescripcion.ejercicios[2]!.series[0]!)).toBe("8–10")
    expect(objetivoDeSerie({ id: u(71), tipoMedicion: "tiempo", pesoKg: null, segundos: 45 })).toBe(
      "45 s",
    )
  })

  it("«La próxima vez» compara los metros con los metros pautados, nunca con repeticiones", () => {
    const hecho = (valor: string, rir: number) => ({ hecha: true, peso: "32", valor, rir })
    const deTransporte = (edicion: EdicionRegistro) =>
      proximaVez(conTransporte, edicion, new Set()).find((p) => p.ejercicioId === u(6))
    expect(
      deTransporte(conMetros({ [u(61)]: hecho("20", 3), [u(62)]: hecho("20", 2) })),
    ).toMatchObject({ texto: "Sube a 34 kg", tipo: "sube" })
    expect(
      deTransporte(conMetros({ [u(61)]: hecho("20", 3), [u(62)]: hecho("15", 3) })),
    ).toMatchObject({ texto: "32 kg, igual", tipo: "igual" })
  })
})
