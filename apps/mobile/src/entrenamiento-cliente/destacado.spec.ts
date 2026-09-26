import { destacadoDe } from "./destacado"
import type { FilaDeSemana } from "./use-semana"

let siguienteId = 0

function fila(
  fecha: string,
  opciones: { enviada?: boolean; enCurso?: boolean; cerrada?: boolean } = {},
): FilaDeSemana {
  siguienteId += 1
  return {
    agenda: {
      id: `00000000-0000-4000-8000-${String(siguienteId).padStart(12, "0")}`,
      clienteId: "00000000-0000-4000-8000-000000000000",
      fechaOriginal: fecha,
      fechaActual: fecha,
      estado: opciones.cerrada === true ? "cerrada" : "abierta",
      revision: 1,
    },
    nombre: `Sesión del ${fecha}`,
    enviadoEn: opciones.enviada === true ? `${fecha}T10:00:00.000Z` : null,
    enCurso: opciones.enCurso === true,
  }
}

const HOY = "2026-09-23"

describe("la tarjeta de hoy", () => {
  it("enseña la sesión de hoy que falta por enviar", () => {
    const deHoy = fila(HOY, { enCurso: true })
    expect(destacadoDe([fila("2026-09-21"), deHoy, fila("2026-09-25")], HOY)).toEqual({
      tipo: "hoy",
      fila: deHoy,
    })
  })

  it("con dos hoy, la que falta aunque la otra ya esté enviada", () => {
    const pendiente = fila(HOY)
    expect(destacadoDe([fila(HOY, { enviada: true }), pendiente], HOY)).toMatchObject({
      tipo: "hoy",
      fila: pendiente,
    })
  })

  it("si hoy ya está hecho lo celebra y cuenta lo atrasado que sigue abierto", () => {
    const hecha = fila(HOY, { enviada: true })
    const resultado = destacadoDe(
      [
        fila("2026-09-21"),
        fila("2026-09-22", { cerrada: true, enviada: true }),
        hecha,
        fila("2026-09-25"),
      ],
      HOY,
    )
    expect(resultado).toEqual({ tipo: "hecho", fila: hecha, atrasadas: 1 })
  })

  it("sin nada hoy, la siguiente de la semana", () => {
    const siguiente = fila("2026-09-25")
    expect(destacadoDe([fila("2026-09-21"), siguiente, fila("2026-09-27")], HOY)).toMatchObject({
      tipo: "proximo",
      fila: siguiente,
    })
  })

  it("sin nada por delante, descanso con lo atrasado", () => {
    expect(destacadoDe([fila("2026-09-21"), fila("2026-09-22")], HOY)).toEqual({
      tipo: "descanso",
      atrasadas: 2,
    })
    expect(destacadoDe([], HOY)).toEqual({ tipo: "descanso", atrasadas: 0 })
  })
})
