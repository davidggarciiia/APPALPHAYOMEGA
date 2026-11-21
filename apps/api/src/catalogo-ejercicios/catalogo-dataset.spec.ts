import { CrearEjercicioSchema } from "@alpha-omega/shared"

import { CATALOGO_AMPLIADO } from "./catalogo-ampliado.js"
import { CATALOGO_DATASET } from "./catalogo-dataset.js"
import { normalizarNombre } from "./catalogo-ejercicios.service.js"
import { CATALOGO_INICIAL } from "./catalogo-inicial.js"

describe("biblioteca ampliada de ejercicios", () => {
  it("cada ficha cumple el contrato de un ejercicio", () => {
    const invalidas = CATALOGO_DATASET.filter(
      ({ categoria: _categoria, origen: _origen, ...ficha }) =>
        !CrearEjercicioSchema.safeParse(ficha).success,
    )
    expect(invalidas.map((ficha) => ficha.nombre)).toEqual([])
  })

  it("no repite nombres ni identificadores de origen", () => {
    const nombres = CATALOGO_DATASET.map((ficha) => normalizarNombre(ficha.nombre))
    expect(new Set(nombres).size).toBe(nombres.length)
    const origenes = CATALOGO_DATASET.map((ficha) => ficha.origen.id)
    expect(new Set(origenes).size).toBe(origenes.length)
  })

  it("no pisa las fichas propias del catálogo inicial ni de la ampliación", () => {
    const propias = new Set(
      [...CATALOGO_INICIAL, ...CATALOGO_AMPLIADO].flatMap((ficha) =>
        [ficha.nombre, ...(ficha.equivalentes ?? [])].map(normalizarNombre),
      ),
    )
    const pisadas = CATALOGO_DATASET.filter((ficha) => propias.has(normalizarNombre(ficha.nombre)))
    expect(pisadas.map((ficha) => ficha.nombre)).toEqual([])
  })

  it("llega sin figuras ni dosificación: solo texto", () => {
    expect(CATALOGO_DATASET.length).toBeGreaterThan(1000)
    for (const ficha of CATALOGO_DATASET) {
      expect(ficha.categoria).toBe("biblioteca")
      expect(ficha.instrucciones.length).toBeGreaterThan(0)
    }
  })
})
