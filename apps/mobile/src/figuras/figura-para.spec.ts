import { figuraPara } from "./figura-para"

describe("Figura de cada ejercicio", () => {
  it.each(["Press de banca", "press banca con barra", "PRESS  BANCA"])(
    "%s tiene la figura del press banca",
    (nombre) => {
      expect(figuraPara(nombre)).toBe("press-banca")
    },
  )

  it.each(["Press inclinado con mancuernas", "Sentadilla con barra", "Remo con barra"])(
    "%s todavía no tiene figura",
    (nombre) => {
      expect(figuraPara(nombre)).toBeNull()
    },
  )
})
