import { randomUUID } from "node:crypto"
import { CrearEjercicioSchema } from "@alpha-omega/shared"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import {
  CATALOGO_AMPLIADO,
  type EntradaCatalogoAmpliado,
} from "../src/catalogo-ejercicios/catalogo-ampliado.js"
import { CATALOGO_INICIAL } from "../src/catalogo-ejercicios/catalogo-inicial.js"
import { normalizarNombre } from "../src/catalogo-ejercicios/catalogo-ejercicios.service.js"
import { prepararAmpliacion } from "../src/catalogo-ejercicios/preparar-ampliacion.js"
import { urlDeConexion } from "../src/config/postgres.js"

const sinMetadatos = ({
  categoria: _categoria,
  equivalentes: _equivalentes,
  ...ficha
}: EntradaCatalogoAmpliado) => ficha
const sinRelaciones = ({ gruposSecundarios: _grupos, ...datos }: ReturnType<typeof sinMetadatos>) =>
  datos

describe("Catálogo ampliado textual", () => {
  it("contiene fichas válidas sin repetir nombres ni equivalentes del catálogo inicial", () => {
    expect(CATALOGO_AMPLIADO.length).toBeGreaterThanOrEqual(65)
    const nombres = [...CATALOGO_INICIAL, ...CATALOGO_AMPLIADO].flatMap((e) =>
      [e.nombre, ...(e.equivalentes ?? [])].map(normalizarNombre),
    )
    expect(new Set(nombres).size).toBe(nombres.length)
    for (const entrada of CATALOGO_AMPLIADO) {
      const ficha = sinMetadatos(entrada)
      expect(CrearEjercicioSchema.safeParse(ficha).success).toBe(true)
      expect(ficha.pasos?.length).toBeGreaterThanOrEqual(3)
    }
  })

  describe("preparación conservadora", () => {
    let prisma: PrismaClient
    const prefijo = `e2e-ampliado-${randomUUID()}`
    const ids: string[] = []
    const entrada = (sufijo: string): EntradaCatalogoAmpliado => ({
      nombre: `${prefijo}-${sufijo}`,
      grupoPrincipal: "abdomen",
      gruposSecundarios: [],
      instrucciones: "Mantén el tronco estable.",
      pasos: ["Colócate.", "Controla.", "Vuelve."],
      evita: "Usar impulso.",
      consejos: [],
      categoria: "basicos",
    })
    beforeAll(() => {
      if (process.env.POSTGRES_DB !== "alpha_omega_e2e_codex")
        throw new Error("Solo se admite la base desechable alpha_omega_e2e_codex")
      prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })
    })
    afterEach(async () => {
      // Captura únicamente nombres del prefijo único de esta ejecución.
      const propios = await prisma.ejercicio.findMany({
        where: { nombreNormalizado: { startsWith: prefijo } },
        select: { id: true },
      })
      ids.push(...propios.map((e) => e.id))
      await prisma.ejercicio.deleteMany({ where: { id: { in: ids } } })
    })
    afterAll(async () => {
      await prisma?.$disconnect()
    })

    it("simula sin escribir y es idempotente al confirmar, sin figuras", async () => {
      const entradas = [entrada("nuevo")]
      expect(await prepararAmpliacion(prisma, { confirmar: false, entradas })).toEqual({
        creados: 1,
        yaExistian: 0,
      })
      expect(await prisma.ejercicio.count({ where: { nombre: entradas[0]?.nombre } })).toBe(0)
      expect(await prepararAmpliacion(prisma, { confirmar: true, entradas })).toEqual({
        creados: 1,
        yaExistian: 0,
      })
      expect(await prepararAmpliacion(prisma, { confirmar: true, entradas })).toEqual({
        creados: 0,
        yaExistian: 1,
      })
      const creado = await prisma.ejercicio.findFirstOrThrow({
        where: { nombre: entradas[0]?.nombre },
        include: { contenidos: true },
      })
      expect(creado.estado).toBe("publicado")
      expect(creado.contenidos).toEqual([])
    })

    it("respeta una equivalencia editada y retirada", async () => {
      const ficha = entrada("alias")
      const datos = sinRelaciones(sinMetadatos(ficha))
      const previo = await prisma.ejercicio.create({
        data: {
          ...datos,
          nombreNormalizado: normalizarNombre(ficha.nombre),
          estado: "retirado",
          instrucciones: "Texto del entrenador",
        },
      })
      const nueva = { ...entrada("canonico"), equivalentes: [ficha.nombre] }
      expect(await prepararAmpliacion(prisma, { confirmar: true, entradas: [nueva] })).toEqual({
        creados: 0,
        yaExistian: 1,
      })
      expect(await prisma.ejercicio.findUnique({ where: { id: previo.id } })).toEqual(previo)
    })

    it("rechaza una equivalencia del catálogo inicial antes de escribir", async () => {
      const valida = entrada("valida")
      const duplicada = { ...entrada("duplicada"), equivalentes: ["Peso muerto rumano"] }
      await expect(
        prepararAmpliacion(prisma, { confirmar: true, entradas: [valida, duplicada] }),
      ).rejects.toThrow(/catálogo inicial/)
      expect(await prisma.ejercicio.count({ where: { nombre: valida.nombre } })).toBe(0)
    })

    it("dos cargas simultáneas crean una única ficha", async () => {
      const entradas = [entrada("simultanea")]
      const resultados = await Promise.all([
        prepararAmpliacion(prisma, { confirmar: true, entradas }),
        prepararAmpliacion(prisma, { confirmar: true, entradas }),
      ])
      expect(resultados.reduce((total, resultado) => total + resultado.creados, 0)).toBe(1)
      expect(resultados.reduce((total, resultado) => total + resultado.yaExistian, 0)).toBe(1)
      expect(await prisma.ejercicio.count({ where: { nombre: entradas[0]?.nombre } })).toBe(1)
    })

    it.each(["nombre", "alias", "contenido"])(
      "rechaza %s inválido antes de crear una entrada válida",
      async (tipo) => {
        const valida = entrada("valida")
        const invalida =
          tipo === "nombre"
            ? { ...valida }
            : tipo === "alias"
              ? { ...entrada("otra"), equivalentes: [valida.nombre] }
              : { ...entrada("otra"), instrucciones: "" }
        await expect(
          prepararAmpliacion(prisma, { confirmar: true, entradas: [valida, invalida] }),
        ).rejects.toThrow(tipo === "contenido" ? /instrucciones/ : /repetido/)
        expect(await prisma.ejercicio.count({ where: { nombre: valida.nombre } })).toBe(0)
      },
    )

    it("aborta sin crear nada si dos existentes coinciden con una ficha", async () => {
      const a = entrada("a"),
        b = entrada("b")
      for (const ficha of [a, b]) {
        const datos = sinRelaciones(sinMetadatos(ficha))
        await prisma.ejercicio.create({
          data: {
            ...datos,
            nombreNormalizado: normalizarNombre(ficha.nombre),
            estado: "publicado",
          },
        })
      }
      const nueva = entrada("sin-crear")
      await expect(
        prepararAmpliacion(prisma, {
          confirmar: true,
          entradas: [nueva, { ...a, equivalentes: [b.nombre] }],
        }),
      ).rejects.toThrow(/ambigu/i)
      expect(await prisma.ejercicio.count({ where: { nombre: nueva.nombre } })).toBe(0)
    })
  })
})
