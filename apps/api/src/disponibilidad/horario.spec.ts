import { BadRequestException } from "@nestjs/common"
import { sumarDias } from "../agenda/fechas.js"
import { inicioEnMadrid } from "./horario.js"

describe("hora local del hueco en Madrid", () => {
  it.each([
    ["2027-01-15", "10:30", "2027-01-15T09:30:00.000Z"],
    ["2027-07-15", "10:30", "2027-07-15T08:30:00.000Z"],
    ["2027-01-01", "00:15", "2026-12-31T23:15:00.000Z"],
    ["2028-02-29", "23:45", "2028-02-29T22:45:00.000Z"],
    ["2027-03-28", "03:00", "2027-03-28T01:00:00.000Z"],
    ["2027-10-31", "03:00", "2027-10-31T02:00:00.000Z"],
  ])("convierte %s %s a %s", (fecha, hora, esperado) => {
    expect(inicioEnMadrid(fecha, hora).toISOString()).toBe(esperado)
  })

  it.each([
    ["0001-01-01", "00:00", "0001-01-01T00:14:44.000Z"],
    ["9999-12-31", "10:00", "9999-12-31T09:00:00.000Z"],
  ])(
    "admite el extremo válido %s aunque las muestras salgan del rango ISO",
    (fecha, hora, esperado) => {
      expect(inicioEnMadrid(fecha, hora).toISOString()).toBe(esperado)
    },
  )

  it.each(["0000-01-01", "+010000-01-01"])(
    "rechaza %s fuera del rango admitido con un error claro",
    (fecha) => {
      expect(() => inicioEnMadrid(fecha, "00:00")).toThrow(BadRequestException)
      expect(() => inicioEnMadrid(fecha, "00:00")).toThrow(/rango de fechas/i)
    },
  )

  it("rechaza la hora inexistente del salto de primavera con un mensaje claro", () => {
    expect(() => inicioEnMadrid("2027-03-28", "02:30")).toThrow(BadRequestException)
    expect(() => inicioEnMadrid("2027-03-28", "02:30")).toThrow(/no existe.*cambio de hora/i)
  })

  it("rechaza la hora ambigua repetida en otoño con un mensaje claro", () => {
    expect(() => inicioEnMadrid("2027-10-31", "02:30")).toThrow(BadRequestException)
    expect(() => inicioEnMadrid("2027-10-31", "02:30")).toThrow(/se repite.*otra hora/i)
  })

  it.each([
    ["2027-03-21", "2027-03-21T09:00:00.000Z", "2027-03-28T08:00:00.000Z"],
    ["2027-10-24", "2027-10-24T08:00:00.000Z", "2027-10-31T09:00:00.000Z"],
  ])("repetir siete días desde %s conserva las 10:00 locales", (fecha, primero, segundo) => {
    expect(inicioEnMadrid(fecha, "10:00").toISOString()).toBe(primero)
    expect(inicioEnMadrid(sumarDias(fecha, 7), "10:00").toISOString()).toBe(segundo)
  })
})
