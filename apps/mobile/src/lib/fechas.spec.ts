import { diasDeLaSemana, fechaCorta, fechaLarga, momento, rangoDeSemana } from "./fechas"

describe("Fechas en palabras", () => {
  it("nombra los días sin pasar por la zona del teléfono", () => {
    expect(fechaLarga("2026-09-14")).toBe("lunes 14 de septiembre")
    expect(fechaCorta("2026-09-20")).toBe("dom 20")
    expect(diasDeLaSemana("2026-12-28")).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ])
  })

  it("resume la semana, también a caballo de dos meses o dos años", () => {
    expect(rangoDeSemana("2026-09-14")).toBe("14 – 20 sep 2026")
    expect(rangoDeSemana("2026-12-28")).toBe("28 dic – 3 ene 2027")
  })

  it("enseña los instantes en hora de Madrid", () => {
    expect(momento("2026-09-14T16:32:00.000Z")).toBe("14/09 a las 18:32")
  })
})
