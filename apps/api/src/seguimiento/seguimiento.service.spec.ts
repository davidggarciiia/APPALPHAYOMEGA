import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type GuardarConfiguracionSeguimiento,
} from "@alpha-omega/shared"
import { jest } from "@jest/globals"
import type { PrismaService } from "../prisma/prisma.service.js"
import { SeguimientoService } from "./seguimiento.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"

const clienteId = "00000000-0000-4000-8000-000000000001"
const entrenadorId = "00000000-0000-4000-8000-000000000002"
const pruebaId = "00000000-0000-4000-8000-000000000003"
const operacionId = "00000000-0000-4000-8000-000000000004"
const medidaId = "00000000-0000-4000-8000-000000000005"

function entorno() {
  let fila: { clienteId: string; revision: number; documento: unknown } | null = null
  const prisma = {
    usuario: { findFirst: jest.fn(async () => ({ fechaNacimiento: null, estado: "activo" })) },
    configuracionSeguimiento: {
      findUnique: jest.fn(async () => fila),
      create: jest.fn(async ({ data }: { data: typeof fila }) => {
        if (fila !== null) throw { code: "P2002" }
        fila = data
        return fila
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { revision: number }
          data: { revision: { increment: number }; documento: unknown }
        }) => {
          if (fila?.revision !== where.revision) throw { code: "P2025" }
          fila = {
            ...fila,
            revision: fila.revision + data.revision.increment,
            documento: data.documento,
          }
          return fila
        },
      ),
    },
    medidaCorporal: {
      findFirst: jest.fn(
        async ({
          where,
        }: {
          where: Record<string, string>
        }): Promise<Record<string, unknown> | null> =>
          where.autorId === entrenadorId || where.id !== medidaId
            ? null
            : {
                id: medidaId,
                clienteId,
                autorId: where.autorId,
                fecha: new Date("2026-09-24T00:00:00Z"),
                pesoKg: 80,
                cinturaCm: null,
                grasaPct: null,
                alturaCm: null,
                creadoEn: new Date("2026-09-24T12:00:00Z"),
              },
      ),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    pruebaFisica: {
      findUnique: jest.fn(async () => null),
      findFirst: jest.fn(async (): Promise<Record<string, unknown> | null> => null),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: pruebaId,
        creadoEn: new Date("2026-09-24T12:00:00Z"),
        ...data,
      })),
    },
  }
  const tx = { ...prisma, $queryRaw: async () => [{ retiradoEn: null }] }
  const repositorio = {
    ...tx,
    $transaction: async <T>(ejecutar: (cliente: typeof tx) => Promise<T>) => ejecutar(tx),
  }
  const proveedor = repositorio as unknown as PrismaService
  return {
    servicio: new SeguimientoService(proveedor, new ConsentimientoService(proveedor)),
    prisma,
  }
}

describe("SeguimientoService: configuración", () => {
  it("da valores iniciales diarios sin crear una fila ni tocar el histórico", async () => {
    const { servicio, prisma } = entorno()
    expect(await servicio.configuracion(clienteId)).toEqual(CONFIGURACION_SEGUIMIENTO_INICIAL)
    expect(prisma.configuracionSeguimiento.create).not.toHaveBeenCalled()
  })

  it("crea con revisión cero y rechaza una actualización obsoleta", async () => {
    const { servicio } = entorno()
    const datos: GuardarConfiguracionSeguimiento = {
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      indicadores: ["peso", "pruebas"],
      pruebasPrescritas: [{ id: pruebaId, nombre: "Flexiones", unidad: "reps" }],
    }
    expect(await servicio.guardarConfiguracion(clienteId, datos)).toEqual({ ...datos, revision: 1 })
    await expect(servicio.guardarConfiguracion(clienteId, datos)).rejects.toMatchObject({
      status: 409,
    })
    expect(await servicio.guardarConfiguracion(clienteId, { ...datos, revision: 1 })).toEqual({
      ...datos,
      revision: 2,
    })
  })

  it("vincula el resultado del cliente con la prueba prescrita y copia nombre y unidad", async () => {
    const { servicio, prisma } = entorno()
    await servicio.guardarConfiguracion(clienteId, {
      ...CONFIGURACION_SEGUIMIENTO_INICIAL,
      pruebasPrescritas: [{ id: pruebaId, nombre: "Flexiones", unidad: "reps" }],
    })
    const resultado = await servicio.registrarPrueba(
      { sub: clienteId, rol: "cliente", sid: "sesion" },
      clienteId,
      { operacionId, fecha: "2026-09-24", pruebaId, valor: 32 },
    )
    expect(prisma.pruebaFisica.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pruebaId, nombre: "Flexiones", unidad: "reps" }),
    })
    expect(resultado).toMatchObject({ pruebaId, nombre: "Flexiones", unidad: "reps" })
  })

  it("rechaza pruebas libres del cliente y permite leer las heredadas sin referencia", async () => {
    const { servicio } = entorno()
    await expect(
      servicio.registrarPrueba({ sub: clienteId, rol: "cliente", sid: "sesion" }, clienteId, {
        operacionId,
        fecha: "2026-09-24",
        nombre: "Plancha",
        unidad: "s",
        valor: 30,
      }),
    ).rejects.toMatchObject({ status: 400 })
    const resultado = await servicio.registrarPrueba(
      { sub: entrenadorId, rol: "entrenador", sid: "sesion" },
      clienteId,
      { operacionId, fecha: "2026-09-24", nombre: "Plancha", unidad: "s", valor: 30 },
    )
    expect(resultado).toMatchObject({ pruebaId: null, nombre: "Plancha", valor: 30 })
  })
})

describe("SeguimientoService: borrar registros propios", () => {
  const cliente = { sub: clienteId, rol: "cliente" as const, sid: "sesion" }

  it("borra la medida que tomó el propio cliente y la devuelve", async () => {
    const { servicio, prisma } = entorno()
    const borrada = await servicio.borrarMedida(cliente, clienteId, medidaId)
    expect(borrada).toMatchObject({ id: medidaId, autorId: clienteId, pesoKg: 80 })
    expect(prisma.medidaCorporal.deleteMany).toHaveBeenCalledWith({
      where: { id: medidaId, clienteId, autorId: clienteId },
    })
  })

  it("responde 404 si la medida es de otro autor o no existe, sin borrar nada", async () => {
    const { servicio, prisma } = entorno()
    await expect(
      servicio.borrarMedida({ ...cliente, sub: entrenadorId }, clienteId, medidaId),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      servicio.borrarMedida(cliente, clienteId, "00000000-0000-4000-8000-000000000009"),
    ).rejects.toMatchObject({ status: 404 })
    expect(prisma.medidaCorporal.deleteMany).not.toHaveBeenCalled()
  })

  it("responde 404 si otra petición la borró entre la lectura y el borrado", async () => {
    const { servicio, prisma } = entorno()
    prisma.medidaCorporal.deleteMany.mockResolvedValueOnce({ count: 0 })
    await expect(servicio.borrarMedida(cliente, clienteId, medidaId)).rejects.toMatchObject({
      status: 404,
    })
  })

  it("borra solo la prueba que anotó el propio cliente", async () => {
    const { servicio, prisma } = entorno()
    await expect(servicio.borrarPrueba(cliente, clienteId, pruebaId)).rejects.toMatchObject({
      status: 404,
    })
    prisma.pruebaFisica.findFirst.mockResolvedValueOnce({
      id: pruebaId,
      autorId: clienteId,
      pruebaId: null,
      fecha: new Date("2026-09-24T00:00:00Z"),
      nombre: "Plancha",
      valor: 30,
      unidad: "s",
      creadoEn: new Date("2026-09-24T12:00:00Z"),
    })
    prisma.pruebaFisica.deleteMany.mockResolvedValueOnce({ count: 1 })
    expect(await servicio.borrarPrueba(cliente, clienteId, pruebaId)).toMatchObject({
      id: pruebaId,
      nombre: "Plancha",
    })
    expect(prisma.pruebaFisica.deleteMany).toHaveBeenLastCalledWith({
      where: { id: pruebaId, clienteId, autorId: clienteId },
    })
  })
})
