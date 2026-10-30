import { PrescripcionSchema, ResultadoEntrenamientoSchema } from "@alpha-omega/shared"
import { jest } from "@jest/globals"
import type { Prisma } from "@prisma/client"
import type { PrismaService } from "../prisma/prisma.service.js"
import { SesionesService } from "./sesiones.service.js"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const clienteId = uuid(1)
const catalogoId = uuid(2)
const actor = { sub: clienteId, rol: "cliente" as const, sid: uuid(3) }
const ejercicio = (n: number, kilos: number, ejercicioId = catalogoId) => ({
  id: uuid(n),
  ejercicioId,
  nombre: "Banca",
  indicaciones: null,
  series: [
    { id: uuid(n + 1), tipoMedicion: "repeticiones" as const, pesoKg: kilos, repeticiones: 5 },
  ],
})
const actual = {
  id: uuid(4),
  clienteId,
  version: 1,
  prescripcion: PrescripcionSchema.parse({ nombre: "Siguiente", ejercicios: [ejercicio(10, 60)] }),
}
function enviada(n: number, ejercicios = [ejercicio(20, 60)], hecha = true) {
  const prescripcion = PrescripcionSchema.parse({ nombre: "Enviada", ejercicios })
  const resultado = ResultadoEntrenamientoSchema.parse({
    sesionId: uuid(n),
    prescripcion,
    revisionPrescripcion: 0,
    enviadoEn: new Date(Date.UTC(2026, 8, 28, 10, 0, -n)).toISOString(),
    notas: null,
    series: ejercicios.flatMap((e) =>
      e.series.map((s) => ({
        serieId: s.id,
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: s.pesoKg, repeticiones: s.repeticiones },
      })),
    ),
  })
  if (!hecha) resultado.series[0] = { serieId: ejercicios[0]!.series[0]!.id, hecha: false }
  return {
    id: uuid(n),
    clienteId,
    version: 1,
    resultado,
    agenda: {
      id: uuid(n),
      clienteId,
      fechaOriginal: new Date("2026-09-28"),
      fechaActual: new Date("2026-09-28"),
      estado: "cerrada",
      revision: 1,
    },
  }
}
type Enviada = ReturnType<typeof enviada>
function servicio(filas: Enviada[]) {
  const prisma = {
    usuario: { findFirst: async () => ({ id: clienteId }) },
    $queryRaw: async () => {
      const seleccionadas = new Map<Enviada, string[]>()
      for (const { ejercicioId } of actual.prescripcion.ejercicios) {
        const ultima = filas.find((fila) =>
          fila.resultado.prescripcion.ejercicios.some((e) => e.ejercicioId === ejercicioId),
        )
        if (ultima) {
          const ids = seleccionadas.get(ultima) ?? []
          ids.push(ejercicioId)
          seleccionadas.set(ultima, ids)
        }
      }
      return [...seleccionadas].map(([fila, ejercicioIds]) => ({
        ejercicioIds,
        resultado: fila.resultado,
        version: fila.version,
      }))
    },
    sesionEntrenamiento: {
      findUnique: async () => actual,
      findMany: async () => filas,
    },
  }
  return new SesionesService(prisma as unknown as PrismaService)
}
describe("SesionesService: ejecuciones anteriores", () => {
  it("la ficha omite la revisión sin alterar el dato histórico del detalle ni el resultado", async () => {
    const fila = {
      ...enviada(100),
      prescripcion: enviada(100).resultado.prescripcion,
      revisionPrescripcion: 0,
      iniciada: true,
      enviadoEn: new Date("2026-09-28T12:00:00Z"),
      revisadaEn: new Date("2026-09-28T13:00:00Z"),
    }
    const sesiones = new SesionesService({
      usuario: { findFirst: async () => ({ id: clienteId }) },
      sesionEntrenamiento: {
        findUnique: async () => fila,
        findMany: async () => [fila],
      },
    } as unknown as PrismaService)
    const entrenador = { ...actor, rol: "entrenador" as const }
    const listado = await sesiones.resultados(entrenador, clienteId, 60)
    expect(listado.resultados[0]).not.toHaveProperty("revisadaEn")
    expect(listado.resultados[0]?.resultado).toEqual(fila.resultado)
    expect((await sesiones.leer(entrenador, fila.id)).revisadaEn).toBe("2026-09-28T13:00:00.000Z")
  })

  it("la fuerza solo usa trabajo principal, excluidas aproximaciones, circuito y vuelta a la calma", async () => {
    const principal = ejercicio(20, 60)
    const fila = enviada(100, [principal])
    for (const [n, seccion] of (["calentamiento", "circuito", "final"] as const).entries()) {
      const extra = { ...ejercicio(30 + n * 2, 500, uuid(50 + n)), seccion }
      fila.resultado.prescripcion.ejercicios.push(extra)
      fila.resultado.series.push({
        serieId: extra.series[0]!.id,
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 500, repeticiones: 5, rir: null },
      })
    }
    const resultado = await servicio([fila]).fuerza(actor, clienteId)
    expect(resultado.ejercicios.map(({ ejercicioId }) => ejercicioId)).toEqual([catalogoId])
  })
  it("elige la mejor serie entre calentamiento y principal del mismo ejercicio", async () => {
    const resultado = await servicio([
      enviada(100, [ejercicio(20, 20), ejercicio(30, 60)]),
    ]).anteriores(actor, actual.id)
    expect(resultado.anteriores[0]?.valores.pesoKg).toBe(60)
    expect(resultado.anteriores[0]).toMatchObject({
      series: [{ numero: 1, valores: { pesoKg: 60 } }],
    })
  })
  it("numera las series hechas por su prescripción histórica, aunque se registren desordenadas", async () => {
    const fila = enviada(100)
    const prescripcion = PrescripcionSchema.parse({
      nombre: "Anterior con cinco series",
      ejercicios: [
        {
          ...ejercicio(20, 90),
          series: [
            { id: uuid(24), tipoMedicion: "repeticiones", pesoKg: 90, repeticiones: 6 },
            { id: uuid(21), tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 8 },
            { id: uuid(23), tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 5 },
            { id: uuid(22), tipoMedicion: "tiempo", pesoKg: null, segundos: 60 },
            { id: uuid(25), tipoMedicion: "distancia", pesoKg: null, metros: 100 },
          ],
        },
      ],
    })
    fila.resultado = ResultadoEntrenamientoSchema.parse({
      ...fila.resultado,
      prescripcion,
      series: [
        {
          serieId: uuid(22),
          hecha: true,
          valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 55, rir: 2 },
        },
        {
          serieId: uuid(21),
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 7, rir: 1 },
        },
        {
          serieId: uuid(25),
          hecha: true,
          valores: { tipoMedicion: "distancia", pesoKg: null, metros: 90, rir: 3 },
        },
        { serieId: uuid(23), hecha: false, omitida: true },
        {
          serieId: uuid(24),
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: 90, repeticiones: 5, rir: 0 },
        },
      ],
    })

    const resultado = await servicio([fila]).anteriores(actor, actual.id)

    expect(resultado.anteriores).toEqual([
      {
        ejercicioId: catalogoId,
        fecha: fila.resultado.enviadoEn,
        valores: { tipoMedicion: "repeticiones", pesoKg: 90, repeticiones: 5, rir: 0 },
        series: [
          {
            numero: 1,
            valores: { tipoMedicion: "repeticiones", pesoKg: 90, repeticiones: 5, rir: 0 },
          },
          {
            numero: 2,
            valores: { tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 7, rir: 1 },
          },
          { numero: 4, valores: { tipoMedicion: "tiempo", pesoKg: null, segundos: 55, rir: 2 } },
          { numero: 5, valores: { tipoMedicion: "distancia", pesoKg: null, metros: 90, rir: 3 } },
        ],
      },
    ])
  })
  it("conserva la mejor serie por ocurrencia al combinar metros con repeticiones y segundos", async () => {
    const fila = enviada(100)
    const repeticiones = { tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 }
    const distancia = { tipoMedicion: "distancia", pesoKg: null, metros: 100 }
    const tiempo = { tipoMedicion: "tiempo", pesoKg: null, segundos: 20 }
    fila.resultado = ResultadoEntrenamientoSchema.parse({
      ...fila.resultado,
      prescripcion: {
        nombre: "Dos ocurrencias",
        ejercicios: [
          { ...ejercicio(20, 0), series: [{ id: uuid(21), ...repeticiones }] },
          {
            ...ejercicio(30, 0),
            series: [
              { id: uuid(31), ...distancia },
              { id: uuid(32), ...tiempo },
            ],
          },
        ],
      },
      series: [
        { serieId: uuid(21), hecha: true, valores: repeticiones },
        { serieId: uuid(31), hecha: true, valores: distancia },
        { serieId: uuid(32), hecha: true, valores: tiempo },
      ],
    })

    const resultado = await servicio([fila]).anteriores(actor, actual.id)

    expect(resultado.anteriores[0]?.valores).toEqual(repeticiones)
  })
  it("consulta las últimas enviadas en una sola selección parametrizada y acotada por ejercicio", async () => {
    const sesion = {
      ...actual,
      prescripcion: PrescripcionSchema.parse({
        nombre: "Tres ejercicios",
        ejercicios: [ejercicio(10, 60), ejercicio(30, 20, uuid(5)), ejercicio(40, 10, uuid(6))],
      }),
    }
    const consultar = jest.fn(async (_consulta: Prisma.Sql) => [])
    const historial = jest.fn(async () => [])
    const sesiones = new SesionesService({
      $queryRaw: consultar,
      sesionEntrenamiento: { findUnique: async () => sesion, findMany: historial },
    } as unknown as PrismaService)

    expect(await sesiones.anteriores(actor, actual.id)).toEqual({ anteriores: [] })

    expect(consultar).toHaveBeenCalledTimes(1)
    expect(historial).not.toHaveBeenCalled()
    const consulta = consultar.mock.calls[0]![0]
    const sql = consulta.sql.replace(/\s+/g, " ")
    expect(sql).toContain('DISTINCT ON (r."ejercicioId")')
    expect(sql).toContain('"referencias_ejercicio"')
    expect(sql).toContain('s."clienteId" = ?')
    expect(sql).toContain('s."id" <> ?')
    expect(sql).toContain('s."enviadoEn" IS NOT NULL')
    expect(sql).toContain('s."resultado" IS NOT NULL')
    expect(sql).toContain('ORDER BY r."ejercicioId", s."enviadoEn" DESC, s."id" DESC')
    expect(consulta.values).toEqual(
      expect.arrayContaining([clienteId, actual.id, catalogoId, uuid(5), uuid(6)]),
    )
    expect(sql).not.toContain(clienteId)
    expect(sql).not.toContain("borrador")
  })
  it("usa para cada ejercicio solo la sesión seleccionada, aunque otra incluya ambos ejercicios", async () => {
    const antigua = enviada(200, [ejercicio(20, 100), ejercicio(30, 20, uuid(5))])
    const reciente = enviada(100, [ejercicio(40, 60)])
    const sesiones = new SesionesService({
      $queryRaw: async () => [
        { ejercicioIds: [uuid(5)], resultado: antigua.resultado, version: antigua.version },
        { ejercicioIds: [catalogoId], resultado: reciente.resultado, version: reciente.version },
      ],
      sesionEntrenamiento: {
        findUnique: async () => ({
          ...actual,
          prescripcion: PrescripcionSchema.parse({
            nombre: "Dos ejercicios",
            ejercicios: [ejercicio(10, 60), ejercicio(50, 20, uuid(5))],
          }),
        }),
      },
    } as unknown as PrismaService)

    const resultado = await sesiones.anteriores(actor, actual.id)

    expect(resultado.anteriores).toEqual([
      {
        ejercicioId: uuid(5),
        fecha: antigua.resultado.enviadoEn,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 5 },
        series: [
          { numero: 1, valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 5 } },
        ],
      },
      {
        ejercicioId: catalogoId,
        fecha: reciente.resultado.enviadoEn,
        valores: { tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 5 },
        series: [
          { numero: 1, valores: { tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 5 } },
        ],
      },
    ])
  })
  it("comprueba el acceso a la sesión antes de consultar las ejecuciones anteriores", async () => {
    const consultar = jest.fn(async () => [])
    const sesiones = new SesionesService({
      $queryRaw: consultar,
      sesionEntrenamiento: { findUnique: async () => ({ ...actual, clienteId: uuid(99) }) },
    } as unknown as PrismaService)

    await expect(sesiones.anteriores(actor, actual.id)).rejects.toThrow(
      "Entrenamiento no disponible",
    )
    expect(consultar).not.toHaveBeenCalled()
  })
  it("rechaza un resultado histórico con una versión no soportada", async () => {
    const fila = enviada(100)
    fila.version = 2
    await expect(servicio([fila]).anteriores(actor, actual.id)).rejects.toThrow(
      "No se puede leer el documento de entrenamiento",
    )
  })
  it("da un único punto de fuerza por ejercicio y sesión aunque se repita", async () => {
    const resultado = await servicio([enviada(100, [ejercicio(20, 20), ejercicio(30, 60)])]).fuerza(
      actor,
      clienteId,
    )
    expect(resultado.ejercicios[0]?.puntos).toEqual([
      { fecha: "2026-09-28", pesoKg: 60, repeticiones: 5, estimado: 70 },
    ])
  })
  // Sustituye F: «elige el mayor Epley para la ficha, uniendo ocurrencias y omitiendo series no hechas».
  it("reutiliza E1 por carga y luego repeticiones, uniendo ocurrencias y omitiendo series no hechas", async () => {
    const calentamiento = ejercicio(20, 60)
    calentamiento.series[0]!.repeticiones = 10
    calentamiento.series.push({
      id: uuid(22),
      tipoMedicion: "repeticiones",
      pesoKg: 100,
      repeticiones: 10,
    })
    const principal = ejercicio(30, 62.5)
    principal.series[0]!.repeticiones = 6
    principal.series.push({
      id: uuid(32),
      tipoMedicion: "repeticiones",
      pesoKg: 62.5,
      repeticiones: 7,
    })
    const fila = enviada(100, [calentamiento, principal])
    fila.resultado.series[1] = { serieId: uuid(22), hecha: false, omitida: true }

    const resultado = await servicio([fila]).fuerza(actor, clienteId)

    expect(resultado.ejercicios[0]?.puntos).toEqual([
      { fecha: "2026-09-28", pesoKg: 62.5, repeticiones: 7, estimado: 77.1 },
    ])
  })
  it("encuentra la última ejecución tras 60 sesiones de otros ejercicios", async () => {
    const recientes = Array.from({ length: 60 }, (_, n) =>
      enviada(100 + n, [ejercicio(20, 10, uuid(5))]),
    )
    const resultado = await servicio([...recientes, enviada(200)]).anteriores(actor, actual.id)
    expect(resultado.anteriores[0]?.valores.pesoKg).toBe(60)
  })
  // Sustituye la búsqueda tras sesiones sin hacer: la última enviada es la única referencia.
  it("no rescata una sesión antigua si el ejercicio quedó sin hacer en la última enviada", async () => {
    const ultima = enviada(100, [ejercicio(20, 60), ejercicio(30, 10, uuid(5))], false)
    ultima.resultado.series[0] = { serieId: uuid(21), hecha: false, omitida: true }
    const resultado = await servicio([ultima, enviada(200)]).anteriores(actor, actual.id)
    expect(resultado.anteriores).toEqual([])
  })
})
