import {
  nuevaSesion,
  agregarEjercicio,
  convertirSesion,
  desdeSesion,
  moverEjercicio,
} from "./editor-modelo"

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

  it("guarda y reabre el modo RIR, el tipo de carga y la calibración", () => {
    const sesion = agregarEjercicio(nuevaSesion(), {
      id: "10000000-0000-4000-8000-000000000000",
      nombre: "Remo",
    })
    sesion.nombre = "Fuerza"
    const ejercicio = sesion.ejercicios[0]!
    ejercicio.modoRir = "alFinalizarEjercicio"
    ejercicio.tipoCarga = "conCargaExterna"
    ejercicio.calibrar = true
    ejercicio.series[0]!.objetivo = "12"
    ejercicio.series[0]!.peso = "30"
    const guardada = convertirSesion(sesion)
    expect(guardada.ejercicios[0]).toEqual(
      expect.objectContaining({
        modoRir: "alFinalizarEjercicio",
        tipoCarga: "conCargaExterna",
        calibrar: true,
      }),
    )
    expect(guardada.ejercicios[0]!.series[0]!.pesoKg).toBeNull()
    const reabierta = desdeSesion(guardada, { [ejercicio.ejercicioId]: ejercicio.nombre })
    expect(reabierta.ejercicios[0]).toEqual(
      expect.objectContaining({
        modoRir: "alFinalizarEjercicio",
        tipoCarga: "conCargaExterna",
        calibrar: true,
      }),
    )
    expect(convertirSesion(reabierta).ejercicios[0]!.modoRir).toBe("alFinalizarEjercicio")
  })

  it("no inventa opciones al reabrir una sesión histórica y no prescribe kilos sin carga", () => {
    const sesion = agregarEjercicio(nuevaSesion(), {
      id: "10000000-0000-4000-8000-000000000000",
      nombre: "Plancha",
    })
    sesion.nombre = "Fuerza"
    sesion.ejercicios[0]!.series[0]!.objetivo = "30"
    const anterior = convertirSesion(sesion)
    delete anterior.ejercicios[0]!.modoRir
    delete anterior.ejercicios[0]!.tipoCarga
    const reabierta = desdeSesion(anterior, { [sesion.ejercicios[0]!.ejercicioId]: "Plancha" })
    expect(convertirSesion(reabierta).ejercicios[0]!.modoRir).toBeUndefined()
    expect(convertirSesion(reabierta).ejercicios[0]!.tipoCarga).toBeUndefined()
    reabierta.ejercicios[0]!.tipoCarga = "sinCarga"
    reabierta.ejercicios[0]!.series[0]!.peso = "25"
    expect(convertirSesion(reabierta).ejercicios[0]!.series[0]!.pesoKg).toBeNull()
  })
})
