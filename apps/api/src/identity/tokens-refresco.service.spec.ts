import type { PrismaService } from "../prisma/prisma.service.js"

import { TokensRefrescoService } from "./tokens-refresco.service.js"

describe("TokensRefrescoService.revocarTodosDe", () => {
  it("retira la gracia de las sesiones ya rotadas, ademas de revocar las vivas", async () => {
    const filas = [
      { usuarioId: "u-1", revocadoEn: new Date(), motivoRevocacion: "rotacion" },
      {
        usuarioId: "u-1",
        revocadoEn: null as Date | null,
        motivoRevocacion: null as string | null,
      },
      {
        usuarioId: "u-2",
        revocadoEn: null as Date | null,
        motivoRevocacion: null as string | null,
      },
    ]
    const prisma = {
      tokenRefresco: {
        updateMany: ({
          where,
          data,
        }: {
          where: { usuarioId: string; revocadoEn?: null }
          data: { revocadoEn: Date; motivoRevocacion: string }
        }) => {
          const coinciden = filas.filter(
            (fila) =>
              fila.usuarioId === where.usuarioId &&
              (where.revocadoEn === undefined || fila.revocadoEn === where.revocadoEn),
          )
          coinciden.forEach((fila) => Object.assign(fila, data))
          return Promise.resolve({ count: coinciden.length })
        },
      },
    } as unknown as PrismaService

    await new TokensRefrescoService(prisma).revocarTodosDe("u-1")

    expect(filas[0]?.motivoRevocacion).toBe("cierre")
    expect(filas[1]?.motivoRevocacion).toBe("cierre")
    expect(filas[2]?.revocadoEn).toBeNull()
  })
})
