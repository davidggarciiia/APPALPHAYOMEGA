import { MedioIdSchema } from "@alpha-omega/shared"

import { MEDIOS, medioDelIndice } from "./medios.js"

describe("índice de figuras", () => {
  it("cada id es único y cumple el contrato", () => {
    const ids = MEDIOS.map((medio) => medio.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(MedioIdSchema.safeParse(id).success).toBe(true)
  })

  it("trae los 50 clips gratuitos de Vital y las 2 muestras de MoveKit", () => {
    expect(MEDIOS.filter((medio) => medio.fuente === "vital")).toHaveLength(50)
    expect(MEDIOS.filter((medio) => medio.fuente === "movekit")).toHaveLength(2)
  })

  it("solo guarda copia sin conexión lo que la licencia permite", () => {
    // El EULA de Vital permite el uso dentro de la app; la licencia de MoveKit no
    // dice nada de copias en el dispositivo, así que se queda en streaming.
    for (const medio of MEDIOS) expect(medio.sinConexion).toBe(medio.fuente === "vital")
  })

  it("un id que no está en el índice no resuelve a nada", () => {
    expect(medioDelIndice("vital-0054")?.nombre).toBe("Sentadilla trasera con barra")
    expect(medioDelIndice("vital-9999")).toBeUndefined()
  })
})
