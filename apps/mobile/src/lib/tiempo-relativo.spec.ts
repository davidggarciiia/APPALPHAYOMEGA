import { tiempoRelativo } from "./tiempo-relativo"

const ahora = Date.parse("2026-10-30T12:00:00.000Z")

it.each([
  [0, "hace un momento"],
  [59_999, "hace un momento"],
  [60_000, "hace 1 min"],
  [5 * 60_000, "hace 5 min"],
  [60 * 60_000 - 1, "hace 59 min"],
  [60 * 60_000, "hace 1 h"],
  [3 * 60 * 60_000, "hace 3 h"],
  [24 * 60 * 60_000 - 1, "hace 23 h"],
  [24 * 60 * 60_000, "ayer"],
  [2 * 24 * 60 * 60_000 - 1, "ayer"],
  [2 * 24 * 60 * 60_000, "anteayer"],
  [3 * 24 * 60 * 60_000, "hace 3 días"],
  [9 * 24 * 60 * 60_000, "hace 9 días"],
  [-5 * 60_000, "hace un momento"],
])("expresa %s ms de antigüedad como «%s»", (transcurrido, esperado) => {
  const fecha = new Date(ahora - Number(transcurrido)).toISOString()
  expect(tiempoRelativo(fecha, ahora)).toBe(esperado)
})
