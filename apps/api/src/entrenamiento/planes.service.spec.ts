import { PlanAsignadoSchema } from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { hashPeticion } from "./documentos.js"
import { PlanesService } from "./planes.service.js"

it("devuelve la asignación original aunque la revisión editable del bloque haya cambiado", async () => {
  const id = "00000000-0000-4000-8000-000000000001"
  const datos = {
    operacionId: id,
    nombre: "Plan",
    semanaInicial: "2026-09-28",
    semanas: 1,
    patron: {
      sesiones: [
        {
          id,
          nombre: "A",
          diaSemana: 1,
          ejercicios: [
            {
              id,
              ejercicioId: id,
              indicaciones: null,
              series: [{ id, tipoMedicion: "repeticiones" as const, pesoKg: 20, repeticiones: 5 }],
            },
          ],
        },
      ],
    },
  }
  const respuesta = PlanAsignadoSchema.parse({
    id,
    operacionId: id,
    sesiones: [
      {
        nombre: "A",
        enviadoEn: null,
        agenda: {
          id,
          clienteId: id,
          fechaOriginal: "2026-09-28",
          fechaActual: "2026-09-28",
          revision: 0,
          estado: "abierta",
        },
      },
    ],
  })
  const tx = {
    $executeRaw: async () => {},
    planEntrenamiento: {
      findUnique: async () => ({
        version: 2,
        respuesta,
        hashPeticion: hashPeticion({ clienteId: id, datos }),
      }),
    },
  }
  const prisma = { $transaction: async <T>(f: (t: typeof tx) => Promise<T>) => f(tx) }
  await expect(
    new PlanesService(prisma as unknown as PrismaService).asignar(
      { sub: id, rol: "entrenador", sid: id },
      id,
      datos,
    ),
  ).resolves.toEqual(respuesta)
})
