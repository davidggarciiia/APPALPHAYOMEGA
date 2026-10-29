import { PrescripcionSchema, ResultadoEntrenamientoSchema } from "@alpha-omega/shared"
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
    sesionEntrenamiento: {
      findUnique: async () => actual,
      findMany: async (consulta: {
        take: number
        cursor?: { id: string }
        skip?: number
        where?: { referencias?: { some: { ejercicioId: { in: string[] } } } }
      }) => {
        const ids = consulta.where?.referencias?.some.ejercicioId.in
        const candidatas = ids
          ? filas.filter((f) =>
              f.resultado.prescripcion.ejercicios.some((e) => ids.includes(e.ejercicioId)),
            )
          : filas
        const inicio = consulta.cursor
          ? candidatas.findIndex((f) => f.id === consulta.cursor!.id) + (consulta.skip ?? 0)
          : (consulta.skip ?? 0)
        return candidatas.slice(inicio, inicio + consulta.take)
      },
    },
  }
  return new SesionesService(prisma as unknown as PrismaService)
}
describe("SesionesService: ejecuciones anteriores", () => {
  it("elige la mejor serie entre calentamiento y principal del mismo ejercicio", async () => {
    const resultado = await servicio([
      enviada(100, [ejercicio(20, 20), ejercicio(30, 60)]),
    ]).anteriores(actor, actual.id)
    expect(resultado.anteriores[0]?.valores.pesoKg).toBe(60)
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
  it("elige la mejor serie de E1 por kilos y repeticiones, uniendo ocurrencias y omitiendo series no hechas", async () => {
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
    const fila = enviada(100, [calentamiento, principal])
    fila.resultado.series[1] = { serieId: uuid(22), hecha: false, omitida: true }

    const resultado = await servicio([fila]).fuerza(actor, clienteId)

    expect(resultado.ejercicios[0]?.puntos).toEqual([
      { fecha: "2026-09-28", pesoKg: 62.5, repeticiones: 6, estimado: 75 },
    ])
  })
  it("encuentra la última ejecución tras 60 sesiones de otros ejercicios", async () => {
    const recientes = Array.from({ length: 60 }, (_, n) =>
      enviada(100 + n, [ejercicio(20, 10, uuid(5))]),
    )
    const resultado = await servicio([...recientes, enviada(200)]).anteriores(actor, actual.id)
    expect(resultado.anteriores[0]?.valores.pesoKg).toBe(60)
  })
  it("sigue buscando tras una página de sesiones donde el ejercicio quedó sin hacer", async () => {
    const recientes = Array.from({ length: 60 }, (_, n) =>
      enviada(100 + n, [ejercicio(20, 60), ejercicio(30, 10, uuid(5))], false),
    )
    const resultado = await servicio([...recientes, enviada(200)]).anteriores(actor, actual.id)
    expect(resultado.anteriores[0]?.valores.pesoKg).toBe(60)
  })
})
