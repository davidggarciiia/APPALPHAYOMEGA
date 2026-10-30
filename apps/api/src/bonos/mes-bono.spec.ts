import { mesBono } from "./mes-bono.js"

describe("mes natural del bono en Madrid", () => {
  it.each([
    ["2026-01-31T22:59:59.999Z", "2026-01"],
    ["2026-01-31T23:00:00.000Z", "2026-02"],
    ["2026-06-30T21:59:59.999Z", "2026-06"],
    ["2026-06-30T22:00:00.000Z", "2026-07"],
    ["2026-12-31T22:59:59.999Z", "2026-12"],
    ["2026-12-31T23:00:00.000Z", "2027-01"],
  ])("%s pertenece al mes %s", (instante, esperado) => {
    expect(mesBono(new Date(instante))).toBe(esperado)
  })

  it.each([
    "2026-03-29T00:59:59.999Z",
    "2026-03-29T01:00:00.000Z",
    "2026-10-25T00:30:00.000Z",
    "2026-10-25T01:30:00.000Z",
  ])("conserva el mes durante el cambio horario: %s", (instante) => {
    expect(mesBono(new Date(instante))).toBe(instante.slice(0, 7))
  })
})
