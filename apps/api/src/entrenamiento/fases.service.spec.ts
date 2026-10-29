import { randomUUID } from "node:crypto"
import {
  aplicarAjustesDeFase,
  PrescripcionSchema,
  redondearCarga,
  type AsignarPlan,
  type Bloque,
  type Prescripcion,
} from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { PlanesService } from "./planes.service.js"

const id = randomUUID()
const identidad = { sub: id, rol: "entrenador" as const, sid: id }

function datosDelPlan() {
  const ejercicio = (compuesto: boolean, pesoKg: number | null) => ({
    id: randomUUID(),
    ejercicioId: id,
    indicaciones: null,
    compuesto,
    ...(compuesto && { subidaKg: 2.5 }),
    rir: { min: 3, max: 3 },
    series: Array.from({ length: 5 }, () => ({
      id: randomUUID(),
      tipoMedicion: "repeticiones" as const,
      pesoKg,
      repeticiones: 8,
    })),
  })
  return {
    operacionId: randomUUID(),
    nombre: "Bloque",
    semanaInicial: "2026-10-05",
    semanas: 4,
    patron: {
      sesiones: [
        {
          id: randomUUID(),
          nombre: "Fuerza",
          diaSemana: 1,
          ejercicios: [ejercicio(true, 80), ejercicio(false, 17), ejercicio(false, null)],
        },
      ],
    },
    bloque: {
      objetivos: [],
      notas: [],
      deportes: [],
      fases: [
        {
          desde: 2,
          hasta: 2,
          nombre: "Mayor estímulo",
          detalle: null,
          ajustes: { rirCompuestos: { min: 1, max: 2 }, rirAccesorios: { min: 1, max: 1 } },
        },
        {
          desde: 3,
          hasta: 3,
          nombre: "Descarga",
          detalle: null,
          ajustes: {
            factorSeries: 0.55,
            factorCarga: 0.875,
            rirCompuestos: { min: 3, max: 4 },
            rirAccesorios: { min: 3, max: 4 },
          },
        },
        {
          desde: 4,
          hasta: 4,
          nombre: "Vuelta",
          detalle: null,
          ajustes: { rirCompuestos: { min: 3, max: 3 }, rirAccesorios: { min: 2, max: 3 } },
        },
      ],
    },
  }
}

async function prescripcionesAsignadas(datos: AsignarPlan): Promise<Prescripcion[]> {
  const prescripciones: Prescripcion[] = []
  const tx = {
    $executeRaw: async () => {},
    $queryRaw: async () => [{ id, nombre: "Ejercicio", estado: "publicado" }],
    usuario: { findUnique: async () => ({ rol: "cliente", estado: "activo" }) },
    planEntrenamiento: { findUnique: async () => null, create: async () => ({}) },
    sesionProgramada: { createMany: async () => ({}) },
    sesionEntrenamiento: {
      createMany: async ({ data }: { data: { prescripcion: Prescripcion }[] }) => {
        prescripciones.push(...data.map((s) => s.prescripcion))
      },
    },
    referenciaEjercicio: { createMany: async () => ({}) },
  }
  const prisma = { $transaction: async <T>(f: (t: typeof tx) => Promise<T>) => f(tx) }
  await new PlanesService(prisma as unknown as PrismaService).asignar(identidad, id, datos)
  return prescripciones
}

it("asigna el estímulo, la descarga y la vuelta según la semana, sin alterar el patrón", async () => {
  const datos = datosDelPlan()
  const patron = structuredClone(datos.patron)
  const sesiones = await prescripcionesAsignadas(datos)
  expect(sesiones).toHaveLength(4)
  expect(sesiones[0]?.ejercicios).toEqual(
    patron.sesiones[0]?.ejercicios.map((e) => ({ ...e, nombre: "Ejercicio" })),
  )
  expect(sesiones[1]?.ejercicios.map((e) => e.rir)).toEqual([
    { min: 1, max: 2 },
    { min: 1, max: 1 },
    { min: 1, max: 1 },
  ])
  expect(sesiones[2]?.ejercicios.map((e) => e.series.length)).toEqual([5, 3, 3])
  expect(sesiones[2]?.ejercicios.map((e) => e.series[0]?.pesoKg)).toEqual([70, 15, null])
  expect(sesiones[2]?.ejercicios.every((e) => e.rir?.min === 3 && e.rir.max === 4)).toBe(true)
  expect(sesiones[2]).toMatchObject({
    fase: { nombre: "Descarga", ajustes: datos.bloque.fases[1]?.ajustes },
  })
  expect(sesiones[0]).not.toHaveProperty("fase")
  expect(sesiones[3]?.ejercicios.map((e) => e.rir)).toEqual([
    { min: 3, max: 3 },
    { min: 2, max: 3 },
    { min: 2, max: 3 },
  ])
  expect(datos.patron).toEqual(patron)
})

it("las fases de texto antiguas conservan la prescripción de todas las semanas", async () => {
  const datos = datosDelPlan()
  const sinAjustes = {
    ...datos,
    bloque: {
      ...datos.bloque,
      fases: datos.bloque.fases.map(({ ajustes: _ajustes, ...fase }) => fase),
    },
  }
  const sesiones = await prescripcionesAsignadas(sinAjustes)
  expect(sesiones.every((s) => JSON.stringify(s) === JSON.stringify(sesiones[0]))).toBe(true)
  expect(sesiones.every((s) => !("fase" in s))).toBe(true)
})

it("una fase de texto superpuesta no tapa los ajustes y la primera fase ajustada prevalece", async () => {
  const datos = datosDelPlan()
  const bloque: Bloque = {
    ...datos.bloque,
    fases: [
      { desde: 1, hasta: 4, nombre: "Base", detalle: null },
      ...datos.bloque.fases,
      { ...datos.bloque.fases[1]!, nombre: "Otra descarga", ajustes: { factorSeries: 0.3 } },
    ],
  }
  const sesiones = await prescripcionesAsignadas({ ...datos, bloque })
  expect(sesiones[2]?.ejercicios.map((e) => e.series.length)).toEqual([5, 3, 3])
})

describe("cálculo de los ajustes de fase", () => {
  function prescripcion(): Prescripcion {
    const datos = datosDelPlan().patron.sesiones[0]!
    return PrescripcionSchema.parse({
      nombre: datos.nombre,
      ejercicios: datos.ejercicios.map((e) => ({ ...e, nombre: "Ejercicio" })),
    })
  }

  it("redondea series con mínimo uno, conserva compuestos, IDs y cargas sin fijar", () => {
    const base = prescripcion()
    base.ejercicios[1]!.series = base.ejercicios[1]!.series.slice(0, 1)
    const copia = structuredClone(base)
    const ajustada = aplicarAjustesDeFase(base, { factorSeries: 0.3, factorCarga: 0.9 })
    expect(ajustada.ejercicios.map((e) => e.series.length)).toEqual([5, 1, 2])
    expect(ajustada.ejercicios[1]!.series[0]!.id).toBe(base.ejercicios[1]!.series[0]!.id)
    expect(ajustada.ejercicios[2]!.series.every((s) => s.pesoKg === null)).toBe(true)
    expect(ajustada.ejercicios.map((e) => e.rir)).toEqual(base.ejercicios.map((e) => e.rir))
    expect(base).toEqual(copia)
    expect(PrescripcionSchema.safeParse(ajustada).success).toBe(true)
  })

  it("sustituye el RIR del grupo indicado y conserva el otro grupo", () => {
    const base = prescripcion()
    const ajustada = aplicarAjustesDeFase(base, { rirCompuestos: { min: 1, max: 2 } })
    expect(ajustada.ejercicios.map((e) => e.rir)).toEqual([
      { min: 1, max: 2 },
      { min: 3, max: 3 },
      { min: 3, max: 3 },
    ])
    expect(aplicarAjustesDeFase(base)).toBe(base)
  })

  it.each([
    [17 * 0.875, undefined, 15],
    [80 * 0.9, 2.5, 72.5],
    [11 * 0.9, 1.25, 10],
    [1000 * 1.1, 3, 999],
    [0, 2.5, 0],
  ])("redondea %s kg con paso %s a %s", (peso, paso, esperado) => {
    expect(redondearCarga(peso, paso)).toBe(esperado)
  })

  it("respeta el límite del contrato al aumentar cargas y las tres unidades de serie", () => {
    const base = prescripcion()
    base.ejercicios[0]!.subidaKg = 3
    base.ejercicios[0]!.series = [
      { id: randomUUID(), tipoMedicion: "repeticiones", pesoKg: 1000, repeticiones: 8 },
      { id: randomUUID(), tipoMedicion: "tiempo", pesoKg: 1000, segundos: 30 },
      { id: randomUUID(), tipoMedicion: "distancia", pesoKg: 1000, metros: 20 },
    ]
    const ajustada = aplicarAjustesDeFase(base, { factorCarga: 1.1 })
    expect(ajustada.ejercicios[0]!.series.map((s) => s.pesoKg)).toEqual([999, 999, 999])
    expect(PrescripcionSchema.safeParse(ajustada).success).toBe(true)
  })
})
