import { describe, expect, it } from "@jest/globals"
import type { Medida } from "@alpha-omega/shared"

import { puntoDePartida } from "./punto-de-partida"

// Datos sintéticos: ninguna medida pertenece a una persona real.
const ENERO = "2026-01-10"
const SEPTIEMBRE = "2026-09-15"

const id = (n: string): string => `40000000-0000-4000-8000-00000000000${n}`

function medida(
  n: string,
  fecha: string,
  valores: Partial<Pick<Medida, "pesoKg" | "grasaPct" | "alturaCm" | "cinturaCm">>,
  creadoEn = `${fecha}T08:00:00.000Z`,
): Medida {
  return {
    id: id(n),
    fecha,
    pesoKg: null,
    cinturaCm: null,
    grasaPct: null,
    alturaCm: null,
    creadoEn,
    ...valores,
  }
}

describe("puntoDePartida", () => {
  it("no calcula masa libre con el peso de enero y la grasa de septiembre", () => {
    const inicio = puntoDePartida([
      medida("1", ENERO, { pesoKg: 80 }),
      medida("2", SEPTIEMBRE, { grasaPct: 20 }),
    ])

    expect(inicio?.toma).toEqual({ medidaId: id("1"), fecha: ENERO })
    expect(inicio?.peso).toEqual({ valor: 80, fecha: ENERO, medidaId: id("1") })
    // La grasa posterior conserva su fecha y su toma, y no alimenta el cálculo.
    expect(inicio?.grasa).toEqual({ valor: 20, fecha: SEPTIEMBRE, medidaId: id("2") })
    expect(inicio?.masaLibre).toBeNull()
  })

  it("tampoco la calcula si la toma posterior repite el peso junto a la grasa", () => {
    const inicio = puntoDePartida([
      medida("1", ENERO, { pesoKg: 80 }),
      medida("2", SEPTIEMBRE, { pesoKg: 78, grasaPct: 20 }),
    ])

    expect(inicio?.peso).toEqual({ valor: 80, fecha: ENERO, medidaId: id("1") })
    expect(inicio?.grasa).toEqual({ valor: 20, fecha: SEPTIEMBRE, medidaId: id("2") })
    expect(inicio?.masaLibre).toBeNull()
  })

  it("calcula masa libre con peso y grasa de una misma toma, con su fecha", () => {
    const inicio = puntoDePartida([
      medida("1", ENERO, { pesoKg: 80, grasaPct: 20, alturaCm: 180 }),
      medida("2", SEPTIEMBRE, { pesoKg: 76, grasaPct: 17 }),
    ])

    expect(inicio).toEqual({
      toma: { medidaId: id("1"), fecha: ENERO },
      peso: { valor: 80, fecha: ENERO, medidaId: id("1") },
      grasa: { valor: 20, fecha: ENERO, medidaId: id("1") },
      altura: { valor: 180, fecha: ENERO, medidaId: id("1") },
      masaLibre: { valor: 64, fecha: ENERO, medidaId: id("1") },
    })
  })

  it("deja ausente lo que ninguna toma contiene, sin ceros", () => {
    const inicio = puntoDePartida([medida("1", ENERO, { pesoKg: 80 })])

    expect(inicio?.peso?.valor).toBe(80)
    expect(inicio?.grasa).toBeNull()
    expect(inicio?.altura).toBeNull()
    expect(inicio?.masaLibre).toBeNull()
  })

  it("sin peso, grasa ni altura no hay punto de partida", () => {
    expect(puntoDePartida([])).toBeNull()
    // La cintura tiene su propia evolución; no fecha el bloque de Inicio.
    expect(puntoDePartida([medida("1", ENERO, { cinturaCm: 94 })])).toBeNull()
  })

  it("una toma de solo cintura no adelanta la fecha de inicio", () => {
    const inicio = puntoDePartida([
      medida("1", ENERO, { cinturaCm: 94 }),
      medida("2", SEPTIEMBRE, { pesoKg: 80, grasaPct: 20 }),
    ])

    expect(inicio?.toma).toEqual({ medidaId: id("2"), fecha: SEPTIEMBRE })
    expect(inicio?.masaLibre).toEqual({ valor: 64, fecha: SEPTIEMBRE, medidaId: id("2") })
  })

  it("un valor que falta en la primera toma se toma de una posterior con su fecha", () => {
    const inicio = puntoDePartida([
      medida("1", ENERO, { alturaCm: 180 }),
      medida("2", SEPTIEMBRE, { pesoKg: 80, grasaPct: 20 }),
    ])

    expect(inicio?.toma).toEqual({ medidaId: id("1"), fecha: ENERO })
    expect(inicio?.altura).toEqual({ valor: 180, fecha: ENERO, medidaId: id("1") })
    // Peso y grasa proceden de la misma toma de septiembre: el cálculo lleva esa fecha.
    expect(inicio?.masaLibre).toEqual({ valor: 64, fecha: SEPTIEMBRE, medidaId: id("2") })
  })

  it("dos tomas del mismo día no se combinan", () => {
    // Llegan desordenadas: manda la hora de creación, no la posición.
    const inicio = puntoDePartida([
      medida("2", ENERO, { grasaPct: 20 }, `${ENERO}T09:00:00.000Z`),
      medida("1", ENERO, { pesoKg: 80 }, `${ENERO}T08:00:00.000Z`),
    ])

    expect(inicio?.toma).toEqual({ medidaId: id("1"), fecha: ENERO })
    expect(inicio?.peso?.medidaId).toBe(id("1"))
    expect(inicio?.grasa?.medidaId).toBe(id("2"))
    expect(inicio?.masaLibre).toBeNull()
  })

  it("con la misma fecha y autores distintos, cada valor sale de su toma", () => {
    // Cliente y entrenador apuntan el mismo día; el contrato no expone el autor.
    const delCliente = medida("1", ENERO, { pesoKg: 80 }, `${ENERO}T07:30:00.000Z`)
    const delEntrenador = medida("2", ENERO, { pesoKg: 82, grasaPct: 20 }, `${ENERO}T10:00:00.000Z`)

    for (const orden of [
      [delCliente, delEntrenador],
      [delEntrenador, delCliente],
    ]) {
      const inicio = puntoDePartida(orden)
      expect(inicio?.peso).toEqual({ valor: 80, fecha: ENERO, medidaId: id("1") })
      expect(inicio?.grasa).toEqual({ valor: 20, fecha: ENERO, medidaId: id("2") })
      // Ni 64 kg (peso del cliente) ni 65,6 kg (peso del entrenador) mezclados.
      expect(inicio?.masaLibre).toBeNull()
    }
  })

  it("con fecha y hora de creación idénticas desempata por identificador", () => {
    const creadoEn = `${ENERO}T08:00:00.000Z`
    const a = medida("1", ENERO, { pesoKg: 80 }, creadoEn)
    const b = medida("2", ENERO, { pesoKg: 82, grasaPct: 20 }, creadoEn)

    expect(puntoDePartida([b, a])?.toma.medidaId).toBe(id("1"))
    expect(puntoDePartida([a, b])?.toma.medidaId).toBe(id("1"))
  })
})
