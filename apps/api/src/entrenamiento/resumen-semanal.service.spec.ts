import { ForbiddenException } from "@nestjs/common"
import {
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  ResumenSemanalSchema,
} from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ResumenSemanalService } from "./resumen-semanal.service.js"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const actor = { sub: uuid(1), rol: "entrenador" as const, sid: uuid(2) }
const cliente = { id: uuid(3), nombre: "Ana", apellidos: "García" }

function enviada(n: number, fecha: string, pesoKg: number) {
  const prescripcion = PrescripcionSchema.parse({
    nombre: "Fuerza",
    ejercicios: [
      {
        id: uuid(10),
        ejercicioId: uuid(11),
        nombre: "Sentadilla",
        indicaciones: null,
        compuesto: true,
        series: [{ id: uuid(12), tipoMedicion: "repeticiones", pesoKg, repeticiones: 8 }],
      },
    ],
  })
  return {
    id: uuid(n),
    clienteId: cliente.id,
    version: 1,
    agenda: { fechaActual: new Date(fecha) },
    resultado: ResultadoEntrenamientoSchema.parse({
      sesionId: uuid(n),
      prescripcion,
      revisionPrescripcion: 0,
      enviadoEn: `${fecha}T12:00:00Z`,
      notas: null,
      series: [
        {
          serieId: uuid(12),
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg, repeticiones: 8, rir: null },
        },
      ],
    }),
  }
}

function entorno(clientes = [cliente], filas = [enviada(20, "2026-10-19", 60)]) {
  const consultas: unknown[] = []
  const consultar =
    <T>(valor: T) =>
    async (consulta: unknown) => {
      consultas.push(consulta)
      return valor
    }
  const prisma = {
    usuario: { findMany: consultar(clientes) },
    sesionEntrenamiento: {
      findMany: consultar(filas),
      groupBy: consultar([{ clienteId: cliente.id, _count: { _all: 3 } }]),
    },
    molestia: { findMany: consultar([]) },
  }
  return {
    servicio: new ResumenSemanalService(prisma as unknown as PrismaService),
    consultas,
  }
}

describe("ResumenSemanalService", () => {
  it("cierra el acceso antes de consultar datos", async () => {
    const { servicio, consultas } = entorno()
    await expect(servicio.resumen({ ...actor, rol: "cliente" }, "2026-10-19")).rejects.toThrow(
      ForbiddenException,
    )
    expect(consultas).toHaveLength(0)
  })

  it("devuelve una cartera vacía sin consultar sesiones ni molestias", async () => {
    const { servicio, consultas } = entorno([])
    await expect(servicio.resumen(actor, "2026-10-19")).resolves.toEqual({
      semana: "2026-10-19",
      clientes: [],
    })
    expect(consultas).toHaveLength(1)
  })

  it("reutiliza E1 para la baja de dos sesiones y el récord de todo el historial", async () => {
    const { servicio } = entorno(
      [cliente],
      [
        enviada(20, "2026-10-05", 100),
        enviada(21, "2026-10-12", 80),
        enviada(22, "2026-10-19", 60),
      ],
    )
    const resumen = await servicio.resumen(actor, "2026-10-19")
    expect(resumen.clientes[0]).toMatchObject({
      clienteId: cliente.id,
      sesionesPrevistas: 3,
      sesionesEnviadas: 1,
      ultimaFechaEnviada: "2026-10-19",
      ejercicios: [
        {
          sesionesConMarca: 3,
          mejorSerie: { pesoKg: 60, rir: null, estimado1RM: 76 },
          mejorSerieAnterior: { pesoKg: 80 },
          comparacion: { direccion: "baja", diferenciaKg: -20 },
          estado: "Baja",
          record: false,
        },
      ],
    })
  })

  it.each([
    { cargas: [60, 60], estado: null },
    { cargas: [65, 60], estado: null },
    { cargas: [60, 60, 60], estado: "Estancado" },
    { cargas: [70, 65, 60], estado: "Baja" },
    { cargas: [60, 65], estado: "Progresa" },
  ])("observa sesiones consecutivas para $cargas: $estado", async ({ cargas, estado }) => {
    const fechas = ["2026-10-17", "2026-10-18", "2026-10-19"].slice(-cargas.length)
    const { servicio } = entorno(
      [cliente],
      cargas.map((carga, n) => enviada(20 + n, fechas[n]!, carga)),
    )
    const resumen = await servicio.resumen(actor, "2026-10-19")
    expect(resumen.clientes[0]?.ejercicios[0]?.estado).toBe(estado)
  })

  it("ordena sesiones del mismo día por su envío, aunque lleguen en otro orden", async () => {
    const filas = [60, 65, 70].map((carga, n) => {
      const fila = enviada(22 - n, "2026-10-19", carga)
      fila.resultado.enviadoEn = `2026-10-19T${10 + n}:00:00Z`
      return fila
    })
    const desordenadas = [filas[2]!, filas[0]!, filas[1]!]
    for (const orden of [desordenadas, [...desordenadas].reverse()]) {
      const { servicio } = entorno([cliente], orden)
      expect((await servicio.resumen(actor, "2026-10-19")).clientes[0]?.ejercicios[0]?.estado).toBe(
        "Progresa",
      )
    }
  })

  it("conserva el último envío aunque no esté en la semana actual ni en la anterior", async () => {
    const { servicio } = entorno([cliente], [enviada(20, "2026-09-28", 60)])
    expect((await servicio.resumen(actor, "2026-10-19")).clientes[0]).toMatchObject({
      sesionesEnviadas: 0,
      ultimaFechaEnviada: "2026-09-28",
      ejercicios: [],
    })
  })

  it("sin envíos devuelve fecha nula", async () => {
    const { servicio } = entorno([cliente], [])
    expect((await servicio.resumen(actor, "2026-10-19")).clientes[0]).toMatchObject({
      ultimaFechaEnviada: null,
      ejercicios: [],
    })
  })

  it("cuenta solo las sesiones con una marca de fuerza válida", async () => {
    const omitida = enviada(21, "2026-10-12", 60)
    omitida.resultado.prescripcion.ejercicios.push({
      ...omitida.resultado.prescripcion.ejercicios[0]!,
      id: uuid(13),
      seccion: "calentamiento",
      series: [{ id: uuid(14), tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 8 }],
    })
    omitida.resultado.series = [
      { serieId: uuid(12), hecha: false, omitida: true },
      {
        serieId: uuid(14),
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 60, repeticiones: 8, rir: null },
      },
    ]
    const tiempo = enviada(22, "2026-10-15", 60)
    tiempo.resultado.prescripcion.ejercicios[0]!.series = [
      { id: uuid(12), tipoMedicion: "tiempo", pesoKg: 60, segundos: 90 },
    ]
    tiempo.resultado.series = [
      {
        serieId: uuid(12),
        hecha: true,
        valores: { tipoMedicion: "tiempo", pesoKg: 60, segundos: 90, rir: null },
      },
    ]
    const calentamiento = enviada(23, "2026-10-16", 60)
    calentamiento.resultado.prescripcion.ejercicios[0]!.seccion = "calentamiento"
    const { servicio } = entorno(
      [cliente],
      [
        enviada(20, "2026-10-05", 60),
        omitida,
        tiempo,
        calentamiento,
        enviada(24, "2026-10-19", 65),
      ],
    )
    expect((await servicio.resumen(actor, "2026-10-19")).clientes[0]?.ejercicios[0]).toMatchObject({
      sesionesConMarca: 2,
    })
  })

  it("el contrato mantiene las respuestas previas y valida los campos nuevos", async () => {
    const { servicio } = entorno()
    const datos = await servicio.resumen(actor, "2026-10-19")
    const respuesta = datos.clientes[0]!
    delete respuesta.ultimaFechaEnviada
    delete respuesta.ejercicios[0]!.sesionesConMarca
    expect(ResumenSemanalSchema.safeParse(datos).success).toBe(true)
    respuesta.ultimaFechaEnviada = "2026-02-30"
    expect(ResumenSemanalSchema.safeParse(datos).success).toBe(false)
    respuesta.ultimaFechaEnviada = null
    respuesta.ejercicios[0]!.sesionesConMarca = -1
    expect(ResumenSemanalSchema.safeParse(datos).success).toBe(false)
  })

  it("mantiene cuatro consultas por lotes con uno o quince clientes sin leer borradores", async () => {
    for (const cantidad of [1, 15]) {
      const clientes = Array.from({ length: cantidad }, (_, n) => ({
        ...cliente,
        id: uuid(30 + n),
      }))
      const { servicio, consultas } = entorno(clientes)
      const resumen = await servicio.resumen(actor, "2026-10-19")
      expect(resumen.clientes).toHaveLength(cantidad)
      expect(consultas).toHaveLength(4)
      expect(JSON.stringify(consultas)).not.toContain("borrador")
      expect(JSON.stringify(consultas)).not.toContain("revisadaEn")
      expect(JSON.stringify(resumen)).not.toMatch(/revisad|porRevisar|sinRevisar/i)
      expect(consultas[0]).toMatchObject({ where: { rol: "cliente", estado: "activo" } })
      expect(consultas[1]).toMatchObject({
        where: {
          enviadoEn: { not: null },
          agenda: { fechaActual: { lt: new Date("2026-10-26") } },
        },
      })
    }
  })
})
