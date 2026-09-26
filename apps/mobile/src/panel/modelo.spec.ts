import { fechaLarga, momento, rangoDeSemana, textoDeActividad, tituloDeMolestia } from "./modelo"

const ahora = new Date("2026-09-26T10:00:00.000Z") // 12:00 en Madrid

it("dice cuándo pasó algo como lo diría una persona, con los días de Madrid", () => {
  expect(momento("2026-09-26T09:59:40.000Z", ahora)).toBe("ahora")
  expect(momento("2026-09-26T09:48:00.000Z", ahora)).toBe("hace 12 min")
  expect(momento("2026-09-26T07:02:00.000Z", ahora)).toBe("hoy, 09:02")
  expect(momento("2026-09-25T16:05:00.000Z", ahora)).toBe("ayer, 18:05")
  // 23:30 del 24 en UTC ya es día 25 en Madrid: ayer.
  expect(momento("2026-09-24T23:30:00.000Z", ahora)).toBe("ayer, 01:30")
  expect(momento("2026-09-24T10:00:00.000Z", ahora)).toBe("24 sept")
})

it("escribe la fecha de hoy y el rango de la semana", () => {
  expect(fechaLarga("2026-09-26")).toBe("Sábado, 26 de septiembre")
  expect(rangoDeSemana("2026-09-21", "2026-09-27")).toBe("lun 21 – dom 27")
})

it("nombra el nivel de la molestia con palabras y cuenta bien las fotos", () => {
  expect(tituloDeMolestia({ nivel: "ambar", zona: "muneca" })).toBe("Molestia ámbar en la muñeca")
  expect(tituloDeMolestia({ nivel: "verde", zona: "lumbar" })).toBe(
    "Molestia verde en la zona lumbar",
  )
  expect(tituloDeMolestia({ nivel: "rojo", zona: "otra" })).toBe("Molestia roja en otra zona")
  const cliente = { id: "10000000-0000-4000-8000-000000000001", nombre: "Ana" }
  expect(
    textoDeActividad({
      tipo: "fotos",
      id: cliente.id,
      cliente,
      fecha: ahora.toISOString(),
      fotos: 1,
    }),
  ).toBe("Ana mandó 1 foto")
})
