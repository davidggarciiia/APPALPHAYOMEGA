import type { FilaPanel } from "@alpha-omega/shared"

import { estadoDeFilaPanel, nombreCompleto, porDia } from "./panel"

jest.mock("expo-router", () => ({ useIsFocused: () => true, useRouter: () => ({}) }))

let n = 0
function fila(fecha: string, enviada = false): FilaPanel {
  n += 1
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
  return {
    agenda: {
      id,
      clienteId: "00000000-0000-4000-8000-000000000000",
      fechaOriginal: fecha,
      fechaActual: fecha,
      estado: enviada ? "cerrada" : "abierta",
      revision: 1,
    },
    nombre: "Torso",
    enviadoEn: enviada ? `${fecha}T18:00:00.000Z` : null,
    cliente: { id: "00000000-0000-4000-8000-000000000000", nombre: "Laura", apellidos: null },
    ejecucion: enviada ? { seriesHechas: 5, seriesPrescritas: 7 } : null,
  }
}

describe("el panel del entrenador", () => {
  it("dice lo enviado con series y distingue lo pasado sin enviar de lo pendiente", () => {
    expect(estadoDeFilaPanel(fila("2026-09-21", true), "2026-09-23")).toBe(
      "Enviado · 5 de 7 series",
    )
    expect(estadoDeFilaPanel(fila("2026-09-21"), "2026-09-23")).toBe("Sin enviar")
    expect(estadoDeFilaPanel(fila("2026-09-23"), "2026-09-23")).toBe("Pendiente")
  })

  it("agrupa por día en orden", () => {
    const miercoles = fila("2026-09-23")
    const lunesA = fila("2026-09-21")
    const lunesB = fila("2026-09-21", true)
    const grupos = porDia([miercoles, lunesA, lunesB])
    expect(grupos.map(([dia]) => dia)).toEqual(["2026-09-21", "2026-09-23"])
    expect(grupos[0]?.[1]).toEqual([lunesA, lunesB])
  })

  it("el nombre sin apellidos no deja espacios colgando", () => {
    expect(nombreCompleto({ id: "x", nombre: "Laura", apellidos: null })).toBe("Laura")
    expect(nombreCompleto({ id: "x", nombre: "Marc", apellidos: "Puig" })).toBe("Marc Puig")
  })
})
