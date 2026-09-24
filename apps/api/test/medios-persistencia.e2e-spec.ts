import { randomUUID } from "node:crypto"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

// Datos sintéticos en la base desechable: ninguna foto real, solo filas de prueba.
const fecha = new Date("2026-09-24T00:00:00Z")
const caduca = new Date("2026-09-24T10:15:00Z")

describe("Persistencia de fotos privadas y solicitudes (F01b)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let valoracionId: string
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("medios-persistencia")
    const { prisma, ids } = entorno
    const valoracion = await prisma.valoracion.create({
      data: { clienteId: ids.cliente!, autorId: ids.entrenador!, tipo: "inicial" },
    })
    valoracionId = valoracion.id
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  const medio = (cambios: Record<string, unknown> = {}) => ({
    clienteId: entorno.ids.cliente!,
    autorId: entorno.ids.entrenador!,
    operacionId: randomUUID(),
    origen: "profesional" as const,
    vista: "frente" as const,
    etiqueta: null,
    fechaToma: fecha,
    tipoMime: "image/jpeg",
    bytes: 250_000,
    clave: `pruebas/${randomUUID()}`,
    subidaCaducaEn: caduca,
    valoracionId,
    ...cambios,
  })

  it("guarda una foto profesional pendiente sin URL y con operación y clave únicas", async () => {
    const { prisma } = entorno
    const creado = await prisma.medioFoto.create({ data: medio() })
    expect(creado).toMatchObject({ estado: "pendiente", confirmadoEn: null, publicadaEn: null })
    // Solo la clave del objeto: ni URL firmada ni enlace guardados como localización.
    for (const campo of ["url", "urlFirmada", "enlace", "firma"])
      expect(creado).not.toHaveProperty(campo)
    await expect(
      prisma.medioFoto.create({ data: medio({ operacionId: creado.operacionId }) }),
    ).rejects.toThrow()
    await expect(
      prisma.medioFoto.create({ data: medio({ clave: creado.clave }) }),
    ).rejects.toThrow()
  })

  it("las restricciones impiden formatos, tamaños y estados incoherentes", async () => {
    const { prisma } = entorno
    const falla = (cambios: Record<string, unknown>) =>
      expect(prisma.medioFoto.create({ data: medio(cambios) })).rejects.toThrow()
    await falla({ tipoMime: "image/gif" })
    await falla({ bytes: 0 })
    await falla({ bytes: 8 * 1024 * 1024 + 1 })
    await falla({ vista: "otra" })
    await falla({ etiqueta: "Brazo" })
    await falla({ valoracionId: null })
    await falla({ estado: "disponible" })
    await falla({ estado: "eliminado" })
    await falla({ publicadaEn: new Date(), valoracionId: null })
    const otra = await prisma.medioFoto.create({
      data: medio({ vista: "otra", etiqueta: "Brazo" }),
    })
    expect(otra.etiqueta).toBe("Brazo")
  })

  it("una aportación del cliente llega antes de la visita y al incorporarla conserva autor y origen", async () => {
    const { prisma, ids } = entorno
    const solicitud = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente", "espalda"],
      },
    })
    await expect(
      prisma.solicitudFotos.create({
        data: {
          clienteId: ids.cliente!,
          autorId: ids.entrenador!,
          operacionId: solicitud.operacionId,
          vistas: ["frente"],
        },
      }),
    ).rejects.toThrow()
    const aportada = await prisma.medioFoto.create({
      data: medio({
        autorId: ids.cliente!,
        origen: "cliente",
        valoracionId: null,
        solicitudId: solicitud.id,
      }),
    })
    await expect(
      prisma.medioFoto.create({
        data: medio({ autorId: ids.cliente!, origen: "cliente", solicitudId: null }),
      }),
    ).rejects.toThrow()
    const incorporada = await prisma.medioFoto.update({
      where: { id: aportada.id },
      data: { valoracionId },
    })
    expect(incorporada).toMatchObject({
      id: aportada.id,
      autorId: ids.cliente!,
      origen: "cliente",
      solicitudId: solicitud.id,
      valoracionId,
    })
    expect(await prisma.medioFoto.count({ where: { clave: aportada.clave } })).toBe(1)
  })

  it("una solicitud separa recibida de revisada", async () => {
    const { prisma, ids } = entorno
    const base = {
      clienteId: ids.cliente!,
      autorId: ids.entrenador!,
      vistas: ["frente" as const],
    }
    await expect(
      prisma.solicitudFotos.create({
        data: { ...base, operacionId: randomUUID(), estado: "recibida" },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.solicitudFotos.create({
        data: { ...base, operacionId: randomUUID(), estado: "revisada", recibidaEn: new Date() },
      }),
    ).rejects.toThrow()
    await expect(
      prisma.solicitudFotos.create({ data: { ...base, operacionId: randomUUID(), vistas: [] } }),
    ).rejects.toThrow()
    const recibida = await prisma.solicitudFotos.create({
      data: { ...base, operacionId: randomUUID(), estado: "recibida", recibidaEn: new Date() },
    })
    expect(recibida.revisadaEn).toBeNull()
  })
})
