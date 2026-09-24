import { describe, expect, it } from "@jest/globals"

import { ejercicioDePrueba } from "./pruebas/catalogo-en-memoria"
import { tecnicaDesdeTexto, tecnicaEnTexto } from "./tecnica-texto"

describe("Técnica escrita en el formulario", () => {
  it("convierte líneas en pasos y consejos, sin líneas vacías", () => {
    expect(
      tecnicaDesdeTexto({
        pasos: "Pies firmes.\n\n  Baja controlado.  ",
        evita: " Rebotar. ",
        consejos: "Respira: coge aire arriba.\nPara si: pinchazo o dolor.",
      }),
    ).toEqual({
      pasos: ["Pies firmes.", "Baja controlado."],
      evita: "Rebotar.",
      consejos: [
        { titulo: "Respira", texto: "coge aire arriba." },
        { titulo: "Para si", texto: "pinchazo o dolor." },
      ],
    })
  })

  it("deja la ficha vacía si no se escribe nada", () => {
    expect(tecnicaDesdeTexto({ pasos: "", evita: "  ", consejos: "" })).toEqual({
      pasos: [],
      evita: null,
      consejos: [],
    })
  })

  it("no adivina un consejo sin título", () => {
    expect(tecnicaDesdeTexto({ pasos: "", evita: "", consejos: "Respira hondo" })).toEqual({
      error: "Escribe cada consejo como «Título: texto». Revisa «Respira hondo».",
    })
  })

  it("rechaza más de diez pasos", () => {
    const pasos = Array.from({ length: 11 }, (_, n) => `Paso ${n}`).join("\n")
    expect(tecnicaDesdeTexto({ pasos, evita: "", consejos: "" })).toEqual({
      error: "Como mucho diez pasos.",
    })
  })

  it("vuelve al mismo texto que se guardó", () => {
    const ejercicio = {
      ...ejercicioDePrueba("3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4b01", "Press", "pecho"),
      pasos: ["Uno", "Dos"],
      evita: "Rebotar",
      consejos: [{ titulo: "Respira", texto: "arriba" }],
    }
    expect(tecnicaDesdeTexto(tecnicaEnTexto(ejercicio))).toEqual({
      pasos: ["Uno", "Dos"],
      evita: "Rebotar",
      consejos: [{ titulo: "Respira", texto: "arriba" }],
    })
  })
})
