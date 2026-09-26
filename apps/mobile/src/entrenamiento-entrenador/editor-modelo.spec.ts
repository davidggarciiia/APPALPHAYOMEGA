import { SeriePrescritaDistanciaSchema, SesionEnRutinaSchema } from "@alpha-omega/shared"
import {
  nuevaSesion,
  nuevaSerie,
  agregarEjercicio,
  convertirSerie,
  convertirSesion,
  desdeSerie,
  desdeSesion,
  moverEjercicio,
  unidadCorta,
  type SesionConDistancia,
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

// D01: el modelo representa la distancia y, desde D01.g, el contrato público la acepta.
describe("Distancia en metros (D01)", () => {
  const TRANSPORTE = "30000000-0000-4000-8000-000000000000"
  const distancia = SeriePrescritaDistanciaSchema.parse({
    id: "40000000-0000-4000-8000-000000000001",
    tipoMedicion: "distancia",
    pesoKg: 24,
    metros: 20,
  })
  const repeticiones = {
    id: "40000000-0000-4000-8000-000000000002",
    tipoMedicion: "repeticiones",
    pesoKg: 30,
    repeticiones: 8,
  } as const

  it("carga y vuelve a escribir la serie con su id, sus metros y su carga", () => {
    const editable = desdeSerie(distancia)
    expect(editable).toEqual({
      id: distancia.id,
      tipoMedicion: "distancia",
      peso: "24",
      objetivo: "20",
    })
    expect(
      SeriePrescritaDistanciaSchema.parse(
        convertirSerie(editable, { tipoCarga: "conCargaExterna" }),
      ),
    ).toEqual(distancia)
    // Sin carga externa o calibrando no se prescriben kilos.
    expect(convertirSerie(editable, { tipoCarga: "sinCarga" })).toEqual({
      ...distancia,
      pesoKg: null,
    })
    expect(convertirSerie(editable, { calibrar: true })).toEqual({ ...distancia, pesoKg: null })
  })

  it("al reabrir y duplicar una sesión conserva la unidad, la carga y los ids de cada serie", () => {
    const guardada: SesionConDistancia = {
      id: "50000000-0000-4000-8000-000000000000",
      nombre: "Fuerza",
      diaSemana: 2,
      ejercicios: [
        {
          id: "60000000-0000-4000-8000-000000000000",
          ejercicioId: TRANSPORTE,
          indicaciones: null,
          tipoCarga: "conCargaExterna",
          series: [distancia, repeticiones],
        },
      ],
    }
    const reabierta = desdeSesion(guardada, { [TRANSPORTE]: "Transporte con mancuernas" })
    const ejercicio = reabierta.ejercicios[0]!
    expect(ejercicio.series.map((s) => s.tipoMedicion)).toEqual(["distancia", "repeticiones"])
    expect(ejercicio.series.map((s) => convertirSerie(s, ejercicio))).toEqual([
      distancia,
      repeticiones,
    ])
  })

  it("una sesión existente en repeticiones y segundos se guarda igual al reabrirla", () => {
    const existente = SesionEnRutinaSchema.parse({
      id: "50000000-0000-4000-8000-000000000001",
      nombre: "Core",
      diaSemana: 3,
      ejercicios: [
        {
          id: "60000000-0000-4000-8000-000000000001",
          ejercicioId: TRANSPORTE,
          indicaciones: "Sin prisa",
          modoRir: "cadaSerie",
          tipoCarga: "conCargaExterna",
          series: [
            repeticiones,
            {
              id: "40000000-0000-4000-8000-000000000003",
              tipoMedicion: "tiempo",
              pesoKg: null,
              segundos: 40,
            },
          ],
        },
      ],
    })
    expect(convertirSesion(desdeSesion(existente, { [TRANSPORTE]: "Plancha" }))).toEqual(existente)
  })

  it("cambiar la unidad conserva id y carga y no deja la cantidad de la otra unidad", () => {
    const serie = { ...nuevaSerie(), peso: "20", objetivo: "12" }
    const conCarga = { tipoCarga: "conCargaExterna" } as const
    const enMetros = convertirSerie(
      { ...serie, tipoMedicion: "distancia", objetivo: "30" },
      conCarga,
    )
    expect(SeriePrescritaDistanciaSchema.parse(enMetros)).toEqual({
      id: serie.id,
      tipoMedicion: "distancia",
      pesoKg: 20,
      metros: 30,
    })
    expect(convertirSerie({ ...serie, tipoMedicion: "tiempo" }, conCarga)).toEqual({
      id: serie.id,
      tipoMedicion: "tiempo",
      pesoKg: 20,
      segundos: 12,
    })
  })

  it("rotula cada unidad sin tratar los metros como repeticiones ni segundos", () => {
    expect(unidadCorta("repeticiones")).toBe("rep")
    expect(unidadCorta("tiempo")).toBe("s")
    expect(unidadCorta("distancia")).toBe("m")
  })

  it("se publica en D01.g y las series nuevas siguen naciendo en repeticiones", () => {
    const sesion = agregarEjercicio(nuevaSesion(), { id: TRANSPORTE, nombre: "Transporte" })
    sesion.nombre = "Fuerza"
    expect(sesion.ejercicios[0]!.series[0]!.tipoMedicion).toBe("repeticiones")
    sesion.ejercicios[0]!.series = [desdeSerie(distancia)]
    // D01.g invierte el cierre de D01.b: la sesión en metros cumple el contrato público.
    const publicada = convertirSesion(sesion)
    expect(SesionEnRutinaSchema.parse(publicada)).toEqual(publicada)
    expect(publicada.ejercicios[0]).toMatchObject({
      tipoCarga: "conCargaExterna",
      series: [distancia],
    })
  })
})
