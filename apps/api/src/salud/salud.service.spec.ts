import type { PrismaService } from "../prisma/prisma.service.js"

import { SaludService } from "./salud.service.js"

/**
 * El doble se declara con la forma minima que el servicio usa y se convierte al
 * tipo real. Es la alternativa a inventarse una interfaz que solo existiria para
 * los tests, que seria peor diseno que una conversion acotada aqui dentro.
 */
function prismaFalso(queryRaw: () => Promise<unknown>): PrismaService {
  return { $queryRaw: queryRaw } as unknown as PrismaService
}

describe("SaludService", () => {
  it("informa de ok cuando la base de datos responde", async () => {
    const servicio = new SaludService(prismaFalso(() => Promise.resolve([{ uno: 1 }])))

    await expect(servicio.comprobar()).resolves.toEqual({
      estado: "ok",
      baseDeDatos: "ok",
    })
  })

  it("informa de degradado cuando la consulta falla, sin propagar el error", async () => {
    const servicio = new SaludService(
      prismaFalso(() => Promise.reject(new Error("conexion rechazada"))),
    )

    await expect(servicio.comprobar()).resolves.toEqual({
      estado: "degradado",
      baseDeDatos: "sin respuesta",
    })
  })
})
