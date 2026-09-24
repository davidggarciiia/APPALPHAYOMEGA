import { jest } from "@jest/globals"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { SesionesService } from "./sesiones.service.js"
import { MolestiasService } from "./molestias.service.js"

const id = "00000000-0000-4000-8000-000000000001"
const clienteId = "00000000-0000-4000-8000-000000000002"
const sesionId = "00000000-0000-4000-8000-000000000003"
const entrenadorId = "00000000-0000-4000-8000-000000000004"

function entornoConcurrente() {
  let fila = {
    id,
    clienteId,
    sesionId,
    ejercicioPrescritoId: null,
    ejercicio: null,
    serie: null,
    zona: "hombro",
    intensidad: 4,
    sintomas: [],
    nota: null,
    creadaEn: new Date("2026-09-24T10:00:00Z"),
    estado: "abierta" as "abierta" | "atendida",
    respuesta: null as string | null,
    atendidaEn: null as Date | null,
    atendidaPorId: null as string | null,
  }
  let lecturas = 0
  let liberar!: () => void
  const ambasLeidas = new Promise<void>((resolve) => {
    liberar = resolve
  })
  const molestia = {
    findUnique: jest.fn(async () => {
      const vista = { ...fila }
      lecturas += 1
      if (lecturas <= 2) {
        if (lecturas === 2) liberar()
        await ambasLeidas
      }
      return vista
    }),
    findUniqueOrThrow: jest.fn(async () => ({ ...fila })),
    update: jest.fn(async ({ data }: { data: Partial<typeof fila> }) => {
      fila = { ...fila, ...data }
      return { ...fila }
    }),
    updateMany: jest.fn(
      async ({ where, data }: { where: { estado: string }; data: Partial<typeof fila> }) => {
        if (fila.estado !== where.estado) return { count: 0 }
        fila = { ...fila, ...data }
        return { count: 1 }
      },
    ),
  }
  const novedadEntrenamiento = { create: jest.fn(async () => ({ id })) }
  const tx = { molestia, novedadEntrenamiento }
  const prisma = {
    ...tx,
    $transaction: async <T>(ejecutar: (cliente: typeof tx) => Promise<T>): Promise<T> =>
      ejecutar(tx),
  }
  return {
    servicio: new MolestiasService(prisma as unknown as PrismaService, {} as SesionesService),
    molestia,
    novedadEntrenamiento,
    respuestaActual: () => fila.respuesta,
  }
}

describe("MolestiasService.atender", () => {
  it("elige una sola respuesta y crea una sola novedad si dos entrenadores responden a la vez", async () => {
    const { servicio, novedadEntrenamiento, respuestaActual } = entornoConcurrente()
    const identidad = { sub: entrenadorId, rol: "entrenador" as const, sid: "sesion" }
    const resultados = await Promise.allSettled([
      servicio.atender(identidad, id, { respuesta: "Reduce la carga" }),
      servicio.atender(identidad, id, { respuesta: "Suspende el ejercicio" }),
    ])
    const aceptadas = resultados.filter((resultado) => resultado.status === "fulfilled")
    const rechazadas = resultados.filter((resultado) => resultado.status === "rejected")
    expect(aceptadas).toHaveLength(1)
    expect(rechazadas).toHaveLength(1)
    expect(rechazadas[0]).toMatchObject({ reason: { status: 409 } })
    expect(aceptadas[0]).toMatchObject({ value: { respuesta: respuestaActual() } })
    expect(novedadEntrenamiento.create).toHaveBeenCalledTimes(1)
  })

  it("devuelve la misma respuesta a dos reintentos simultáneos sin duplicar la novedad", async () => {
    const { servicio, novedadEntrenamiento } = entornoConcurrente()
    const identidad = { sub: entrenadorId, rol: "entrenador" as const, sid: "sesion" }
    const respuestas = await Promise.all([
      servicio.atender(identidad, id, { respuesta: "Reduce la carga" }),
      servicio.atender(identidad, id, { respuesta: "Reduce la carga" }),
    ])
    expect(respuestas[0]).toEqual(respuestas[1])
    expect(novedadEntrenamiento.create).toHaveBeenCalledTimes(1)
  })
})
