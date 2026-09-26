import { porcentaje, resumirSemana, type SemanaDeCliente } from "./semana.js"

function fila(
  nombre: string,
  programadas: number,
  enviadas: number,
  restantes = 0,
): SemanaDeCliente {
  return {
    cliente: {
      id: `00000000-0000-4000-8000-${nombre.length.toString().padStart(12, "0")}`,
      nombre,
    },
    programadas,
    enviadas,
    restantes,
  }
}

describe("adherencia de la semana", () => {
  it("redondea hacia abajo y no mide lo que no estaba programado", () => {
    expect(porcentaje(199, 200)).toBe(99)
    expect(porcentaje(2, 3)).toBe(66)
    expect(porcentaje(3, 3)).toBe(100)
    expect(porcentaje(0, 0)).toBeNull()
  })

  it("suma la cartera y ordena de menos a más, sin quien lo ha enviado todo", () => {
    const semana = resumirSemana(
      [
        fila("Ana", 2, 2, 1),
        fila("Bea", 4, 1),
        fila("Carmen", 2, 0, 3),
        fila("Dani", 3, 0),
        fila("Eva", 0, 0, 2),
      ],
      "2026-09-21",
      "2026-09-27",
    )
    expect(semana).toMatchObject({
      lunes: "2026-09-21",
      domingo: "2026-09-27",
      programadas: 11,
      enviadas: 3,
      adherencia: 27,
      restantes: 6,
    })
    // A igual porcentaje, primero quien más ha dejado sin enviar.
    expect(semana.menorAdherencia.map((c) => [c.cliente.nombre, c.adherencia])).toEqual([
      ["Dani", 0],
      ["Carmen", 0],
      ["Bea", 25],
    ])
  })

  it("se queda con cinco y sin programadas no hay porcentaje", () => {
    const muchas = ["Ana", "Bea", "Carla", "Dora", "Elena", "Fina"].map((n) => fila(n, 1, 0))
    expect(resumirSemana(muchas, "2026-09-21", "2026-09-27").menorAdherencia).toHaveLength(5)
    expect(resumirSemana([], "2026-09-21", "2026-09-27")).toMatchObject({
      programadas: 0,
      adherencia: null,
      menorAdherencia: [],
    })
  })
})
