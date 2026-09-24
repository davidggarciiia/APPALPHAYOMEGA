import { randomUUID } from "node:crypto"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

// Datos sintéticos: la base es la desechable de pruebas, nunca la de demostración.
const documento = { definiciones: { corporales: [], pruebas: [] }, bloques: ["medidas"] }
const fecha = new Date("2026-09-24T00:00:00Z")

describe("Persistencia de valoraciones (V02)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones-persistencia")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function visita(tipo: "inicial" | "revision" = "inicial", anteriorId?: string) {
    const { prisma, ids } = entorno
    const valoracion = await prisma.valoracion.create({
      data: { clienteId: ids.cliente!, autorId: ids.entrenador!, tipo, anteriorId },
    })
    const borrador = await prisma.borradorValoracion.create({
      data: {
        valoracionId: valoracion.id,
        valoracionAbiertaId: valoracion.id,
        autorId: ids.entrenador!,
        fechaToma: fecha,
        documento,
      },
    })
    return { valoracion, borrador }
  }

  async function publicar(
    valoracionId: string,
    borradorId: string,
    numero: number,
    sustituyeId: string | null = null,
  ) {
    const { prisma, ids } = entorno
    return prisma.$transaction(async (tx) => {
      await tx.borradorValoracion.update({
        where: { id: borradorId },
        data: { valoracionAbiertaId: null },
      })
      return tx.publicacionValoracion.create({
        data: {
          valoracionId,
          borradorId,
          numero,
          sustituyeId,
          fechaToma: fecha,
          autorId: ids.entrenador!,
          documento,
        },
      })
    })
  }

  it("guarda plantilla y visita sin tocar medidas ni pruebas anteriores", async () => {
    const { prisma, ids } = entorno
    const medida = await prisma.medidaCorporal.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.cliente!,
        operacionId: randomUUID(),
        fecha,
        pesoKg: 80,
      },
    })
    await prisma.plantillaValoracion.create({
      data: { clienteId: ids.cliente!, documento: { corporales: [], pruebas: [] } },
    })
    const { valoracion, borrador } = await visita()
    const leida = await prisma.valoracion.findUniqueOrThrow({
      where: { id: valoracion.id },
      include: { borradores: true },
    })
    expect(leida.borradores.map((b) => b.id)).toEqual([borrador.id])
    expect(leida.borradores[0]?.documento).toEqual(documento)
    expect(await prisma.medidaCorporal.findUnique({ where: { id: medida.id } })).not.toBeNull()
  })

  it("admite un solo borrador abierto por visita", async () => {
    const { prisma, ids } = entorno
    const { valoracion } = await visita()
    await expect(
      prisma.borradorValoracion.create({
        data: {
          valoracionId: valoracion.id,
          valoracionAbiertaId: valoracion.id,
          autorId: ids.entrenador!,
          fechaToma: fecha,
          documento,
        },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.borradorValoracion.create({
        data: {
          valoracionId: valoracion.id,
          valoracionAbiertaId: randomUUID(),
          autorId: ids.entrenador!,
          fechaToma: fecha,
          documento,
        },
      }),
    ).rejects.toThrow()
  })

  it("una revisión exige visita anterior y una inicial no la admite", async () => {
    const { prisma, ids } = entorno
    const { valoracion } = await visita()
    const base = { clienteId: ids.cliente!, autorId: ids.entrenador! }
    await expect(
      prisma.valoracion.create({ data: { ...base, tipo: "revision" } }),
    ).rejects.toThrow()
    await expect(
      prisma.valoracion.create({ data: { ...base, tipo: "inicial", anteriorId: valoracion.id } }),
    ).rejects.toThrow()
    const revision = await visita("revision", valoracion.id)
    expect(revision.valoracion.anteriorId).toBe(valoracion.id)
  })

  it("numera publicaciones: la primera no sustituye nada y cada corrección sustituye una sola", async () => {
    const { prisma, ids } = entorno
    const { valoracion, borrador } = await visita()
    const primera = await publicar(valoracion.id, borrador.id, 1)
    await expect(publicar(valoracion.id, borrador.id, 2, primera.id)).rejects.toThrow()

    const correccion = await prisma.borradorValoracion.create({
      data: {
        valoracionId: valoracion.id,
        valoracionAbiertaId: valoracion.id,
        autorId: ids.entrenador!,
        corrigePublicacionId: primera.id,
        fechaToma: fecha,
        documento,
      },
    })
    await expect(publicar(valoracion.id, correccion.id, 2)).rejects.toThrow()
    await expect(publicar(valoracion.id, correccion.id, 1, primera.id)).rejects.toThrow()
    const segunda = await publicar(valoracion.id, correccion.id, 2, primera.id)
    expect(segunda.sustituyeId).toBe(primera.id)

    const otra = await prisma.borradorValoracion.create({
      data: {
        valoracionId: valoracion.id,
        valoracionAbiertaId: valoracion.id,
        autorId: ids.entrenador!,
        fechaToma: fecha,
        documento,
      },
    })
    await expect(publicar(valoracion.id, otra.id, 3, primera.id)).rejects.toThrow()
    await expect(
      prisma.borradorValoracion.create({
        data: {
          valoracionId: valoracion.id,
          autorId: ids.entrenador!,
          corrigePublicacionId: primera.id,
          fechaToma: fecha,
          documento,
        },
      }),
    ).rejects.toThrow()
    const originales = await prisma.publicacionValoracion.findMany({
      where: { valoracionId: valoracion.id },
      orderBy: { numero: "asc" },
    })
    expect(originales.map((p) => p.numero)).toEqual([1, 2])
  })

  it("una operación no se repite y una visita solo cumple una pauta", async () => {
    const { prisma, ids } = entorno
    const { valoracion, borrador } = await visita()
    const operacion = {
      autorId: ids.entrenador!,
      operacionId: randomUUID(),
      tipo: "crear",
      hashPeticion: "huella",
      valoracionId: valoracion.id,
      borradorId: borrador.id,
    }
    await prisma.operacionValoracion.create({ data: operacion })
    await expect(prisma.operacionValoracion.create({ data: operacion })).rejects.toThrow()
    await expect(
      prisma.operacionValoracion.create({
        data: { ...operacion, operacionId: randomUUID(), tipo: "otra" },
      }),
    ).rejects.toThrow()

    await prisma.proximaRevisionValoracion.create({
      data: { clienteId: ids.cliente!, pauta: { fecha: null }, cumplidaPorId: valoracion.id },
    })
    await expect(
      prisma.proximaRevisionValoracion.create({
        data: { clienteId: ids.otro!, cumplidaPorId: valoracion.id },
      }),
    ).rejects.toThrow()
  })
})
