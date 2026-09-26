import { huellaDe, jsonCanonico } from "./huella.js"

describe("Huella de operaciones idempotentes", () => {
  it("no depende del orden de las claves", () => {
    expect(jsonCanonico({ b: 1, a: { d: [1, 2], c: null } })).toBe(
      '{"a":{"c":null,"d":[1,2]},"b":1}',
    )
    expect(huellaDe({ a: 1, b: 2 })).toBe(huellaDe({ b: 2, a: 1 }))
  })

  it("distingue contenidos distintos y el orden de las listas", () => {
    expect(huellaDe({ a: [1, 2] })).not.toBe(huellaDe({ a: [2, 1] }))
    expect(huellaDe({ pesoKg: 40 })).not.toBe(huellaDe({ pesoKg: 40.5 }))
    expect(huellaDe({ pesoKg: null })).not.toBe(huellaDe({}))
  })
})
