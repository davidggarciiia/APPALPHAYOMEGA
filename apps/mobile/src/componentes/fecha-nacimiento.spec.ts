import { fechaEspanolaAIso, isoAFechaEspanola } from "./fecha-nacimiento"

const HOY = new Date("2026-11-21T10:00:00Z")

it("muestra la fecha de la API como DD/MM/AAAA", () => {
  expect(isoAFechaEspanola("1995-04-12")).toBe("12/04/1995")
  expect(isoAFechaEspanola(null)).toBe("")
  expect(isoAFechaEspanola(undefined)).toBe("")
})

it.each([
  ["12/04/1995", "1995-04-12"],
  ["1/4/1995", "1995-04-01"],
  [" 12-04-1995 ", "1995-04-12"],
  ["12.04.1995", "1995-04-12"],
  ["29/02/2000", "2000-02-29"],
])("convierte %s al formato de la API", (texto, iso) => {
  expect(fechaEspanolaAIso(texto, HOY)).toBe(iso)
})

it.each([
  "1995-04-12",
  "31/02/1995",
  "29/02/2001",
  "00/04/1995",
  "12/13/1995",
  "12/04/95",
  "12/04/1899",
  "22/11/2026",
  "",
  "ayer",
])("rechaza %s", (texto) => {
  expect(fechaEspanolaAIso(texto, HOY)).toBeNull()
})
