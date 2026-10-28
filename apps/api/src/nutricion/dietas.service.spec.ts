import { DocumentoDietaSchema } from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import { DietasService } from "./dietas.service.js"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const actor = { sub: id(1), rol: "entrenador" as const, sid: id(2) }
const documento = DocumentoDietaSchema.parse({
  formato: 1,
  nombre: "Pauta sintética",
  tiposDeDia: [
    {
      id: id(3),
      nombre: "Todos",
      objetivo: { kcal: 2100, proteinaG: null, hidratosG: null, grasaG: null },
      comidas: [],
    },
  ],
  semana: Array(7).fill(id(3)),
  indicaciones: [],
  calculo: {
    pesoKg: 80,
    alturaCm: 180,
    edad: 30,
    sexo: "hombre",
    grasaPct: 20,
    factorActividad: 1.5,
    nota: null,
  },
})

function entorno(retirado = true, conBorrador = false) {
  let vigente = !retirado
  let escrituras = 0
  const fila = {
    id: id(4),
    clienteId: id(5),
    estado: "borrador",
    revision: 1,
    version: 1,
    documento,
    actualizadaEn: new Date(),
  }
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) =>
      sql.join("").includes("consentimientos_salud")
        ? [{ retiradoEn: vigente ? null : new Date() }]
        : [{ rol: "cliente", estado: "activo" }],
    dieta: {
      findFirst: async () => (conBorrador ? fila : null),
      findUnique: async () => null,
      create: async () => {
        escrituras++
        return fila
      },
      update: async () => {
        escrituras++
        return { ...fila, publicadaEn: new Date() }
      },
      updateMany: async () => {
        escrituras++
        return { count: 1 }
      },
    },
  }
  const prisma = {
    ...tx,
    $transaction: async <T>(f: (cliente: typeof tx) => Promise<T>) => f(tx),
  } as unknown as PrismaService
  return {
    servicio: new DietasService(prisma, new ConsentimientoService(prisma)),
    escrituras: () => escrituras,
    retirar: () => {
      vigente = false
    },
  }
}

describe("Dietas: cálculo con datos de salud", () => {
  it.each([false, true])(
    "rechaza guardar con consentimiento retirado (borrador previo: %s)",
    async (conBorrador) => {
      const e = entorno(true, conBorrador)
      await expect(
        e.servicio.guardarBorrador(actor, id(5), { revision: conBorrador ? 1 : 0, documento }),
      ).rejects.toMatchObject({ response: { codigo: "consentimiento_pendiente" } })
      expect(e.escrituras()).toBe(0)
    },
  )
  it("rechaza publicar un cálculo guardado antes de retirar el consentimiento", async () => {
    const e = entorno(false, true)
    e.retirar()
    await expect(
      e.servicio.publicar(actor, id(5), { revision: 1, operacionId: id(6) }),
    ).rejects.toMatchObject({ response: { codigo: "consentimiento_pendiente" } })
    expect(e.escrituras()).toBe(0)
  })
  it("con consentimiento vigente guarda el cálculo", async () => {
    const e = entorno(false)
    expect(
      (await e.servicio.guardarBorrador(actor, id(5), { revision: 0, documento })).documento
        .calculo,
    ).toEqual(documento.calculo)
    expect(e.escrituras()).toBe(1)
  })
})
