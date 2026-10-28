import { jest } from "@jest/globals"

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

  describe("cuando la base no contesta", () => {
    afterEach(() => {
      delete process.env.SALUD_PLAZO_MS
    })

    it("informa de degradado dentro del plazo en lugar de esperar a la consulta", async () => {
      process.env.SALUD_PLAZO_MS = "50"
      const servicio = new SaludService(prismaFalso(() => new Promise<unknown>(() => undefined)))
      const inicio = Date.now()

      await expect(servicio.comprobar()).resolves.toEqual({
        estado: "degradado",
        baseDeDatos: "sin respuesta",
      })
      expect(Date.now() - inicio).toBeLessThan(2000)
    })

    it("no deja un temporizador vivo cuando la base contesta a tiempo", async () => {
      jest.useFakeTimers()
      try {
        const servicio = new SaludService(prismaFalso(() => Promise.resolve([{ uno: 1 }])))
        await expect(servicio.comprobar()).resolves.toEqual({ estado: "ok", baseDeDatos: "ok" })
        expect(jest.getTimerCount()).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it("rechaza un plazo inválido al arrancar, no en cada sondeo", () => {
      process.env.SALUD_PLAZO_MS = "-1"
      expect(() => new SaludService(prismaFalso(() => Promise.resolve([])))).toThrow(
        "SALUD_PLAZO_MS",
      )
    })
  })
})
