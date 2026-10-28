import { DocumentoDietaSchema } from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import { ComidasService } from "./comidas.service.js"
import { DietasService } from "./dietas.service.js"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const clienteId = id(1),
  comidaId = id(2),
  dietaId = id(3),
  tipoId = id(4)
const documento = DocumentoDietaSchema.parse({
  formato: 1,
  nombre: "Dieta",
  indicaciones: [],
  semana: Array(7).fill(tipoId),
  tiposDeDia: [
    {
      id: tipoId,
      nombre: "Todos",
      objetivo: null,
      comidas: [
        {
          id: comidaId,
          nombre: "Comida",
          hora: null,
          indicacion: null,
          forma: "intercambio",
          columnas: [
            { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: null }] },
            { nombre: "Hidratos", alimentos: [{ nombre: "Arroz", cantidad: null }] },
          ],
        },
      ],
    },
  ],
})
const datos = {
  dietaId,
  eleccion: {
    tipo: "plato" as const,
    elegidos: [
      { columna: "Proteína", alimento: "Pollo" },
      { columna: "Hidratos", alimento: "Arroz" },
    ],
  },
}
function entorno(doc = documento) {
  let escrituras = 0
  const tx = {
    $queryRaw: async () => [{ retiradoEn: null }],
    dieta: { findFirst: async () => ({ id: dietaId, documento: doc }) },
    comidaRegistrada: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        escrituras++
        return { ...create, registradaEn: new Date() }
      },
    },
  }
  const repositorio = { ...tx, $transaction: async <T>(f: (t: typeof tx) => Promise<T>) => f(tx) }
  const prisma = repositorio as unknown as PrismaService
  return {
    servicio: Reflect.construct(ComidasService, [
      prisma,
      new ConsentimientoService(prisma),
    ]) as ComidasService,
    escrituras: () => escrituras,
  }
}
describe("ComidasService: pauta y vigencia", () => {
  it("rechaza registrar una dieta con registro de comidas desactivado", async () => {
    const e = entorno({ ...documento, registroComidas: false })
    await expect(
      e.servicio.registrar(clienteId, "2026-09-24", comidaId, datos),
    ).rejects.toMatchObject({ status: 409 })
    expect(e.escrituras()).toBe(0)
  })
  it("rechaza un plato que no elige todas las columnas", async () => {
    const e = entorno()
    await expect(
      e.servicio.registrar(clienteId, "2026-09-24", comidaId, {
        dietaId,
        eleccion: { tipo: "plato", elegidos: [datos.eleccion.elegidos[0]!] },
      }),
    ).rejects.toMatchObject({ response: { codigo: "solicitud_invalida" } })
    expect(e.escrituras()).toBe(0)
  })
  it("acepta exactamente una elección por cada columna", async () => {
    const e = entorno()
    await expect(
      e.servicio.registrar(clienteId, "2026-09-24", comidaId, datos),
    ).resolves.toMatchObject({ eleccion: datos.eleccion })
    expect(e.escrituras()).toBe(1)
  })
  it("espera la publicación que ya tiene el bloqueo del cliente y rechaza la dieta archivada", async () => {
    let estadoA = "publicada",
      publicadaB = false,
      escrituras = 0
    let anunciar!: () => void, continuar!: () => void, liberar!: () => void
    const bloqueoTomado = new Promise<void>((r) => (anunciar = r))
    const avanzarPublicacion = new Promise<void>((r) => (continuar = r))
    const publicacionTerminada = new Promise<void>((r) => (liberar = r))
    let numeroTx = 0
    const tabla = {
      findUnique: async () => null,
      findFirst: async ({ where }: { where: { estado: string } }) =>
        where.estado === "borrador"
          ? { id: id(5), revision: 1, documento, version: 1 }
          : { id: publicadaB ? id(5) : dietaId, documento, version: 1 },
      updateMany: async () => {
        estadoA = "archivada"
        return { count: 1 }
      },
      update: async ({ data }: { data: { publicadaEn: Date } }) => {
        publicadaB = true
        return { id: id(5), clienteId, documento, version: 1, publicadaEn: data.publicadaEn }
      },
    }
    const comidaRegistrada = {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        escrituras++
        return { ...create, registradaEn: new Date() }
      },
    }
    const repositorio = {
      dieta: tabla,
      comidaRegistrada,
      $transaction: async <T>(f: (tx: unknown) => Promise<T>) => {
        const esPublicacion = ++numeroTx === 1
        const tx = {
          dieta: tabla,
          comidaRegistrada,
          $queryRaw: async (sql: TemplateStringsArray) => {
            if (sql.join("?").includes('"usuarios"')) {
              if (esPublicacion) {
                anunciar()
                await avanzarPublicacion
              } else await publicacionTerminada
              return [{ rol: "cliente", estado: "activo" }]
            }
            return [{ retiradoEn: null }]
          },
        }
        try {
          return await f(tx)
        } finally {
          if (esPublicacion) liberar()
        }
      },
    }
    const prisma = repositorio as unknown as PrismaService
    const servicio = Reflect.construct(ComidasService, [
      prisma,
      new ConsentimientoService(prisma),
    ]) as ComidasService
    const publicando = new DietasService(prisma, new ConsentimientoService(prisma)).publicar(
      { sub: id(6), rol: "entrenador", sid: id(7) },
      clienteId,
      { operacionId: id(8), revision: 1 },
    )
    await bloqueoTomado
    const ambas = Promise.allSettled([
      publicando,
      servicio.registrar(clienteId, "2026-09-24", comidaId, datos),
    ])
    await new Promise<void>((r) => setImmediate(r))
    continuar()
    const respuestas = await ambas
    expect(respuestas[0].status).toBe("fulfilled")
    expect(estadoA).toBe("archivada")
    expect(respuestas[1]).toMatchObject({
      status: "rejected",
      reason: { response: { codigo: "revision_obsoleta" } },
    })
    expect(escrituras).toBe(0)
  })
})
