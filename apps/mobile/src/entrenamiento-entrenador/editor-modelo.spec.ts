import { nuevaSesion, agregarEjercicio, convertirSesion, moverEjercicio } from "./editor-modelo"

jest.mock("expo-crypto", () => ({
  randomUUID: jest.requireActual<typeof import("node:crypto")>("node:crypto").randomUUID,
}))

describe("Preparar una sesión", () => {
  it("conserva unidades e ids, permite peso vacío y rechaza un objetivo vacío", () => {
    const sesion = agregarEjercicio(nuevaSesion(), {
      id: "10000000-0000-4000-8000-000000000000",
      nombre: "Remo",
    })
    sesion.nombre = "Fuerza"
    const serie = sesion.ejercicios[0]!.series[0]!
    serie.objetivo = "12"
    serie.peso = "20,5"
    expect(convertirSesion(sesion).ejercicios[0]!.series[0]).toEqual({
      id: serie.id,
      tipoMedicion: "repeticiones",
      pesoKg: 20.5,
      repeticiones: 12,
    })
    serie.tipoMedicion = "tiempo"
    serie.peso = ""
    expect(convertirSesion(sesion).ejercicios[0]!.series[0]).toEqual({
      id: serie.id,
      tipoMedicion: "tiempo",
      pesoKg: null,
      segundos: 12,
    })
    serie.objetivo = ""
    expect(() => convertirSesion(sesion)).toThrow()
  })

  it("ordena ejercicios sin modificar el original ni sus series", () => {
    const primero = agregarEjercicio(nuevaSesion(), {
      id: "10000000-0000-4000-8000-000000000000",
      nombre: "Remo",
    })
    const segundo = agregarEjercicio(primero, {
      id: "20000000-0000-4000-8000-000000000000",
      nombre: "Plancha",
    })
    const movido = moverEjercicio(segundo, 1, -1)
    expect(movido.ejercicios.map((e) => e.nombre)).toEqual(["Plancha", "Remo"])
    expect(segundo.ejercicios[0]!.nombre).toBe("Remo")
    expect(movido.ejercicios[0]!.series).toEqual(segundo.ejercicios[1]!.series)
  })
})
