import { PrismaService } from "../src/prisma/prisma.service.js"

/**
 * Con PostgreSQL de verdad: el plazo de consulta configurado llega al servidor
 * (`statement_timeout`), cancela la consulta lenta y deja el pool utilizable.
 * Solo lee (`pg_sleep`); no escribe ninguna fila.
 */
describe("plazos de consulta de PostgreSQL", () => {
  const previo = process.env.PG_QUERY_TIMEOUT_MS
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.PG_QUERY_TIMEOUT_MS = "500"
    prisma = new PrismaService()
    await prisma.onModuleInit()
  })

  afterAll(async () => {
    await prisma.onModuleDestroy()
    if (previo === undefined) delete process.env.PG_QUERY_TIMEOUT_MS
    else process.env.PG_QUERY_TIMEOUT_MS = previo
  })

  it("cancela una consulta más lenta que el plazo y no deja el pool inservible", async () => {
    const inicio = Date.now()

    await expect(prisma.$queryRaw`SELECT pg_sleep(5)`).rejects.toThrow(/timeout/i)
    expect(Date.now() - inicio).toBeLessThan(4000)

    await expect(prisma.$queryRaw`SELECT 1 AS uno`).resolves.toEqual([{ uno: 1 }])
  })

  it("deja pasar una consulta que cabe dentro del plazo", async () => {
    await expect(prisma.$queryRaw`SELECT 2 AS dos FROM pg_sleep(0.05)`).resolves.toEqual([
      { dos: 2 },
    ])
  })
})
