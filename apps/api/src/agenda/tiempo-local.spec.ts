import {
  aInstante,
  calcularHuecos,
  diaSemanaFecha,
  lunesDeFecha,
  mesDeFecha,
  partesLocales,
  restarTramos,
  sumarMeses,
  unirTramos,
  ZONA_AGENDA,
} from "@alpha-omega/shared"

const iso = (t: number): string => new Date(t).toISOString()

describe("hora local de la agenda (Europe/Madrid)", () => {
  it("convierte fecha y minutos locales a instante en invierno y en verano", () => {
    expect(aInstante("2026-01-15", 600, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    )
    expect(aInstante("2026-07-15", 600, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-07-15T08:00:00.000Z",
    )
  })

  it("la hora que no existe el 29 de marzo devuelve null y las de alrededor son correctas", () => {
    expect(aInstante("2026-03-29", 150, ZONA_AGENDA)).toBeNull()
    expect(aInstante("2026-03-29", 90, ZONA_AGENDA)?.toISOString()).toBe("2026-03-29T00:30:00.000Z")
    expect(aInstante("2026-03-29", 180, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-03-29T01:00:00.000Z",
    )
    expect(aInstante("2026-03-29", 600, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-03-29T08:00:00.000Z",
    )
  })

  it("la hora repetida el 25 de octubre se resuelve a la primera", () => {
    expect(aInstante("2026-10-25", 150, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-10-25T00:30:00.000Z",
    )
    expect(aInstante("2026-10-25", 600, ZONA_AGENDA)?.toISOString()).toBe(
      "2026-10-25T09:00:00.000Z",
    )
  })

  it("lee la fecha y la hora locales de un instante, sin depender de la zona del proceso", () => {
    expect(partesLocales(new Date("2026-10-25T22:30:00Z"), ZONA_AGENDA)).toEqual({
      fecha: "2026-10-25",
      minutos: 23 * 60 + 30,
      diaSemana: 7,
    })
    expect(partesLocales(new Date("2026-10-24T22:30:00Z"), ZONA_AGENDA).fecha).toBe("2026-10-25")
  })

  it("calcula lunes, día de la semana y meses", () => {
    expect(diaSemanaFecha("2026-09-28")).toBe(1)
    expect(lunesDeFecha("2026-10-04")).toBe("2026-09-28")
    expect(mesDeFecha("2026-10-25")).toBe("2026-10-01")
    expect(sumarMeses("2026-11-01", 3)).toBe("2027-02-01")
  })

  it("resta y une tramos semiabiertos", () => {
    expect(
      unirTramos([
        { inicio: 5, fin: 8 },
        { inicio: 0, fin: 5 },
      ]),
    ).toEqual([{ inicio: 0, fin: 8 }])
    expect(restarTramos([{ inicio: 0, fin: 10 }], [{ inicio: 3, fin: 5 }])).toEqual([
      { inicio: 0, fin: 3 },
      { inicio: 5, fin: 10 },
    ])
  })
})

describe("calcularHuecos", () => {
  const franjas = [{ diaSemana: 7, inicioMin: 8 * 60, finMin: 14 * 60 }]

  it("con un horario de 8:00 a 14:00 ofrece seis huecos de 60 minutos en punto, también el día del cambio de hora", () => {
    const [dia] = calcularHuecos({
      zona: ZONA_AGENDA,
      desde: "2026-10-25",
      dias: 1,
      franjas,
      aperturas: [],
      ocupado: [],
      duracionMin: 60,
      intervaloMin: 60,
    })
    expect(dia?.huecos.map((h) => iso(h.inicio))).toEqual([
      "2026-10-25T07:00:00.000Z",
      "2026-10-25T08:00:00.000Z",
      "2026-10-25T09:00:00.000Z",
      "2026-10-25T10:00:00.000Z",
      "2026-10-25T11:00:00.000Z",
      "2026-10-25T12:00:00.000Z",
    ])
    const [marzo] = calcularHuecos({
      zona: ZONA_AGENDA,
      desde: "2026-03-29",
      dias: 1,
      franjas,
      aperturas: [],
      ocupado: [],
      duracionMin: 60,
      intervaloMin: 60,
    })
    expect(marzo?.huecos[0] && iso(marzo.huecos[0].inicio)).toBe("2026-03-29T06:00:00.000Z")
    expect(marzo?.huecos).toHaveLength(6)
  })

  it("quita lo ocupado, reanuda después de cada ocupación, suma aperturas y respeta los límites", () => {
    const diez = Date.parse("2026-10-25T09:00:00Z")
    const [dia] = calcularHuecos({
      zona: ZONA_AGENDA,
      desde: "2026-10-25",
      dias: 1,
      franjas,
      aperturas: [
        { inicio: Date.parse("2026-10-25T15:00:00Z"), fin: Date.parse("2026-10-25T17:00:00Z") },
      ],
      ocupado: [{ inicio: diez, fin: diez + 90 * 60_000 }],
      duracionMin: 60,
      intervaloMin: 60,
      minimo: Date.parse("2026-10-25T08:00:00Z"),
    })
    expect(dia?.huecos.map((h) => iso(h.inicio))).toEqual([
      "2026-10-25T08:00:00.000Z",
      "2026-10-25T10:30:00.000Z",
      "2026-10-25T11:30:00.000Z",
      "2026-10-25T15:00:00.000Z",
      "2026-10-25T16:00:00.000Z",
    ])
  })

  it("un día sin franjas no tiene huecos", () => {
    const [lunes] = calcularHuecos({
      zona: ZONA_AGENDA,
      desde: "2026-10-26",
      dias: 1,
      franjas,
      aperturas: [],
      ocupado: [],
      duracionMin: 60,
      intervaloMin: 60,
    })
    expect(lunes).toEqual({ fecha: "2026-10-26", huecos: [] })
  })
})
