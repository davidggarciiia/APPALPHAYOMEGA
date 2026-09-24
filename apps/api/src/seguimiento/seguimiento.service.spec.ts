import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type GuardarConfiguracionSeguimiento,
} from "@alpha-omega/shared"
import { jest } from "@jest/globals"
import type { PrismaService } from "../prisma/prisma.service.js"
import { SeguimientoService } from "./seguimiento.service.js"

const clienteId = "00000000-0000-4000-8000-000000000001"
const entrenadorId = "00000000-0000-4000-8000-000000000002"
const pruebaId = "00000000-0000-4000-8000-000000000003"
const operacionId = "00000000-0000-4000-8000-000000000004"

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
    pruebaFisica: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: pruebaId,
        creadoEn: new Date("2026-09-24T12:00:00Z"),
        ...data,
      })),
    },
  }
  return { servicio: new SeguimientoService(prisma as unknown as PrismaService), prisma }
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
