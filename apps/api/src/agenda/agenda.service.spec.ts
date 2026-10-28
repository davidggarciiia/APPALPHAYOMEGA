import type { PrismaService } from "../prisma/prisma.service.js"
import { AgendaService } from "./agenda.service.js"

it("mover toma entrenamiento antes de agenda para compartir el orden de bloqueo del envío", async () => {
  const id = "00000000-0000-4000-8000-000000000001"
  const bloqueos: string[] = []
  const fila = {
    id,
    clienteId: id,
    fechaOriginal: new Date("2026-09-28"),
    fechaActual: new Date("2026-09-28"),
    estado: "abierta",
    revision: 0,
  }
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) => {
      bloqueos.push(sql.join("?").includes('"sesiones_entrenamiento"') ? "entrenamiento" : "agenda")
      return [{ id }]
    },
    sesionProgramada: {
      findFirst: async () => fila,
      update: async () => ({ ...fila, fechaActual: new Date("2026-09-29"), revision: 1 }),
    },
    cambioDeFecha: { create: async () => ({}) },
    novedadEntrenamiento: { create: async () => ({}) },
  }
  const prisma = { $transaction: async <T>(f: (t: typeof tx) => Promise<T>) => f(tx) }
  await new AgendaService(prisma as unknown as PrismaService).mover(
    { sub: id, rol: "cliente", sid: id },
    id,
    { fecha: "2026-09-29", revision: 0 },
  )
  expect(bloqueos).toEqual(["entrenamiento", "agenda"])
})
