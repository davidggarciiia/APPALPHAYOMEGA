import { describe, expect, it } from "@jest/globals"
import { MedioFotoSchema, type MedioFoto } from "@alpha-omega/shared"

import {
  diasEntre,
  fechaDeTomaValida,
  fotosPorDia,
  haceDias,
  separacion,
  vistaDe,
} from "./fotos-modelo"

// Datos sintéticos: ninguna foto ni persona real.
const id = (n: number): string => `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`
function foto(n: number, datos: Partial<MedioFoto>): MedioFoto {
  return MedioFotoSchema.parse({
    id: id(n),
    clienteId: "10000000-0000-4000-8000-000000000000",
    autor: { id: "10000000-0000-4000-8000-000000000000", nombre: "Clienta Demo" },
    origen: "cliente",
    vista: "frente",
    etiqueta: null,
    fechaToma: "2026-09-24",
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 120_000,
    valoracionId: null,
    solicitudId: null,
    creadoEn: "2026-09-24T09:00:00.000Z",
    confirmadoEn: "2026-09-24T09:01:00.000Z",
    ...datos,
  })
}

describe("días transcurridos", () => {
  it("cuenta días de calendario, también al cruzar meses y años bisiestos", () => {
    expect(diasEntre("2026-07-04", "2026-09-26")).toBe(84)
    expect(diasEntre("2028-02-28", "2028-03-01")).toBe(2)
    expect(diasEntre("2026-09-26", "2026-09-20")).toBe(-6)
  })

  it("dice hoy, ayer o hace cuántos días", () => {
    expect(haceDias("2026-09-26", "2026-09-26")).toBe("Hoy")
    expect(haceDias("2026-09-25", "2026-09-26")).toBe("Ayer")
    expect(haceDias("2026-07-04", "2026-09-26")).toBe("Hace 84 días")
    expect(haceDias("2026-09-27", "2026-09-26")).toBe("Mañana")
  })

  it("separa dos fotos en días, sin importar el orden; el mismo día no es una separación", () => {
    expect(separacion("2026-09-26", "2026-07-04")).toBe("84 días entre las dos fotos")
    expect(separacion("2026-09-25", "2026-09-26")).toBe("1 día entre las dos fotos")
    expect(separacion("2026-09-26", "2026-09-26")).toBeNull()
  })
})

describe("galería por fechas", () => {
  it("agrupa por día, el más reciente primero y las vistas en su orden; sin pendientes ni retiradas", () => {
    const dias = fotosPorDia([
      foto(1, { fechaToma: "2026-07-04", vista: "espalda" }),
      foto(2, { fechaToma: "2026-09-24", vista: "otra", etiqueta: "Brazo" }),
      foto(3, { fechaToma: "2026-09-24", vista: "perfilDerecho" }),
      foto(4, { fechaToma: "2026-09-24", vista: "frente" }),
      foto(5, { fechaToma: "2026-09-25", estado: "pendiente" }),
      foto(6, { fechaToma: "2026-09-25", estado: "eliminado" }),
      foto(7, { fechaToma: "2026-07-04", vista: "frente" }),
    ])
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-24", "2026-07-04"])
    expect(dias[0]!.fotos.map(vistaDe)).toEqual(["Frente", "Perfil derecho", "Brazo"])
    expect(dias[1]!.fotos.map((f) => f.id)).toEqual([id(7), id(1)])
  })
})

describe("fecha de toma escrita a mano", () => {
  it("acepta días reales hasta hoy y rechaza el resto", () => {
    expect(fechaDeTomaValida("2026-09-26", "2026-09-26")).toBe(true)
    expect(fechaDeTomaValida("2026-02-28", "2026-09-26")).toBe(true)
    expect(fechaDeTomaValida("2026-09-27", "2026-09-26")).toBe(false)
    expect(fechaDeTomaValida("2026-02-30", "2026-09-26")).toBe(false)
    expect(fechaDeTomaValida("26-09-2026", "2026-09-26")).toBe(false)
    expect(fechaDeTomaValida("", "2026-09-26")).toBe(false)
  })
})
