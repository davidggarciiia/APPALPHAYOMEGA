import type { EjercicioPrescrito, ListadoResultados, SesionCliente } from "@alpha-omega/shared"
import { describe, expect, it, jest } from "@jest/globals"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import type { ApiEntrenamiento } from "./api"
import { cargarSugerenciasDeProgresion } from "./progresion-cliente"

const ejercicio: EjercicioPrescrito = {
  id: "actual",
  ejercicioId: "banca",
  nombre: "Press banca",
  indicaciones: null,
  tipoCarga: "conCargaExterna",
  subidaKg: 2.5,
  rir: { min: 2, max: 3 },
  series: [
    { id: "s1", tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8, repeticionesMax: 10 },
    { id: "s2", tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8, repeticionesMax: 10 },
  ],
}
const sesion: SesionCliente = {
  agenda: {
    id: "actual",
    clienteId: "cliente",
    fechaOriginal: "2026-10-29",
    fechaActual: "2026-10-29",
    estado: "abierta",
    revision: 0,
  },
  prescripcion: { nombre: "Empuje", ejercicios: [ejercicio] },
  revisionPrescripcion: 0,
  permiteAjuste: true,
  enviadoEn: null,
  borrador: null,
}

function anterior(fecha = "2026-10-22"): ListadoResultados["resultados"][number] {
  return {
    agenda: { ...sesion.agenda, id: fecha, fechaActual: fecha },
    resultado: {
      sesionId: fecha,
      enviadoEn: `${fecha}T12:00:00.000Z`,
      prescripcion: {
        nombre: "Empuje anterior",
        ejercicios: [{ ...ejercicio, id: "prescripcion-anterior" }],
      },
      revisionPrescripcion: 0,
      notas: null,
      series: ejercicio.series.map((serie) => ({
        serieId: serie.id,
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10, rir: 2 },
      })),
    },
  }
}

function preparar(resultados = [anterior()]) {
  const api = {
    resultados: jest.fn<ApiEntrenamiento["resultados"]>(async () => ({ resultados })),
  }
  const catalogo = { leer: jest.fn<ApiDeCatalogo["leer"]>() }
  return { api, catalogo }
}

describe("E1 · sugerencia del cliente desde resultados enviados", () => {
  it("evalúa la prescripción histórica completa y usa el incremento actual sin mutar datos", async () => {
    const ultima = anterior()
    const { api, catalogo } = preparar([ultima])
    const copia = JSON.stringify(ultima)
    const actual = {
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        ejercicios: [{ ...ejercicio, subidaKg: 1.25, rir: { min: 3, max: 3 } }],
      },
    }
    expect(await cargarSugerenciasDeProgresion(api, catalogo, actual)).toEqual(
      new Map([[ejercicio.id, 1.25]]),
    )
    expect(api.resultados).toHaveBeenCalledWith("cliente", 60)
    expect(catalogo.leer).not.toHaveBeenCalled()
    expect(JSON.stringify(ultima)).toBe(copia)
    expect(actual.prescripcion.ejercicios[0]!.series[0]!.pesoKg).toBe(40)
  })

  it.each(["omitida", "rir nulo", "bajo el tope"])(
    "no rescata una sesión antigua cuando la última tiene una serie %s",
    async (caso) => {
      const ultima = anterior()
      ultima.resultado.series[1] =
        caso === "omitida"
          ? { serieId: "s2", hecha: false, omitida: true }
          : {
              serieId: "s2",
              hecha: true,
              valores: {
                tipoMedicion: "repeticiones",
                pesoKg: 40,
                repeticiones: caso === "bajo el tope" ? 9 : 10,
                rir: caso === "rir nulo" ? null : 2,
              },
            }
      const { api, catalogo } = preparar([anterior("2026-10-15"), ultima])
      expect(await cargarSugerenciasDeProgresion(api, catalogo, sesion)).toEqual(new Map())
    },
  )

  it("ignora la sesión abierta y los resultados posteriores a su fecha", async () => {
    const propia = anterior()
    propia.resultado.sesionId = sesion.agenda.id
    const { api, catalogo } = preparar([propia, anterior("2026-10-30")])
    expect(await cargarSugerenciasDeProgresion(api, catalogo, sesion)).toEqual(new Map())
  })

  it("sin historial no sugiere ni consulta el catálogo", async () => {
    const { api, catalogo } = preparar([])
    expect(await cargarSugerenciasDeProgresion(api, catalogo, sesion)).toEqual(new Map())
    expect(catalogo.leer).not.toHaveBeenCalled()
  })

  it("usa el catálogo para distinguir tren inferior cuando no hay subida prescrita", async () => {
    const { api, catalogo } = preparar()
    catalogo.leer.mockResolvedValue({
      id: ejercicio.ejercicioId,
      nombre: ejercicio.nombre,
      grupoPrincipal: "cuadriceps",
      gruposSecundarios: [],
      instrucciones: "Técnica",
      pasos: [],
      evita: null,
      consejos: [],
      estado: "publicado",
      figura: null,
      video: null,
    })
    const actual = {
      ...sesion,
      prescripcion: { ...sesion.prescripcion, ejercicios: [{ ...ejercicio, subidaKg: undefined }] },
    }
    expect(await cargarSugerenciasDeProgresion(api, catalogo, actual)).toEqual(
      new Map([[ejercicio.id, 5]]),
    )
    expect(catalogo.leer).toHaveBeenCalledWith(ejercicio.ejercicioId)
  })

  it("si falla el catálogo omite el incremento sin adivinar por el nombre", async () => {
    const { api, catalogo } = preparar()
    catalogo.leer.mockRejectedValue(new Error("Sin conexión"))
    const actual = {
      ...sesion,
      prescripcion: { ...sesion.prescripcion, ejercicios: [{ ...ejercicio, subidaKg: undefined }] },
    }
    expect(await cargarSugerenciasDeProgresion(api, catalogo, actual)).toEqual(new Map())
  })

  it("una descarga no propone aumentar carga", async () => {
    const { api, catalogo } = preparar()
    const actual = {
      ...sesion,
      prescripcion: {
        ...sesion.prescripcion,
        fase: { nombre: "Descarga", ajustes: { factorCarga: 0.875 } },
      },
    }
    expect(await cargarSugerenciasDeProgresion(api, catalogo, actual)).toEqual(new Map())
  })

  it.each(["actual", "anterior"])(
    "si el ejercicio se repite en la sesión %s no elige solo una aparición",
    async (donde) => {
      const ultima = anterior()
      const actual = { ...sesion, prescripcion: { ...sesion.prescripcion } }
      if (donde === "actual")
        actual.prescripcion.ejercicios = [ejercicio, { ...ejercicio, id: "repetido" }]
      else ultima.resultado.prescripcion.ejercicios.push({ ...ejercicio, id: "repetido" })
      const { api, catalogo } = preparar([ultima])
      expect(await cargarSugerenciasDeProgresion(api, catalogo, actual)).toEqual(new Map())
    },
  )
})
