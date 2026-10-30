const assert = require("node:assert/strict")
const { test } = require("node:test")
const { AnteriorSchema, ListadoAnterioresSchema } = require("../dist")

const valores = { tipoMedicion: "repeticiones", pesoKg: 50, repeticiones: 10, rir: 2 }
const anterior = {
  ejercicioId: "00000000-0000-4000-8000-000000000001",
  fecha: "2026-10-28T12:00:00.000Z",
  valores,
}

test("anteriores: conserva el contrato sin marcas por serie", () => {
  assert.deepEqual(ListadoAnterioresSchema.parse({ anteriores: [anterior] }), {
    anteriores: [anterior],
  })
})

test("anteriores: admite marcas numeradas con repeticiones, tiempo, distancia y RIR", () => {
  const ampliado = {
    ...anterior,
    series: [
      { numero: 1, valores },
      {
        numero: 2,
        valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 45, rir: 0 },
      },
      {
        numero: 4,
        valores: { tipoMedicion: "distancia", pesoKg: 20, metros: 30, rir: null },
      },
    ],
  }
  assert.deepEqual(AnteriorSchema.parse(ampliado), ampliado)
  assert.deepEqual(AnteriorSchema.parse({ ...anterior, series: [] }).series, [])
})

test("anteriores: rechaza números inválidos, duplicados y valores de otra unidad", () => {
  for (const series of [
    [{ numero: 0, valores }],
    [{ numero: 31, valores }],
    [{ numero: 1.5, valores }],
    [
      { numero: 1, valores },
      { numero: 1, valores },
    ],
    [{ numero: 1, valores: { ...valores, segundos: 45 } }],
    [{ numero: 1, valores: { ...valores, rir: 6 } }],
    Array.from({ length: 31 }, (_, i) => ({ numero: i + 1, valores })),
  ]) {
    assert.equal(AnteriorSchema.safeParse({ ...anterior, series }).success, false)
  }
})
