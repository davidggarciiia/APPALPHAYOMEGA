import { jest } from "@jest/globals"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { SesionesService } from "./sesiones.service.js"
import { NovedadesService } from "./novedades.service.js"

const id = "00000000-0000-4000-8000-000000000001"
const clienteId = "00000000-0000-4000-8000-000000000002"
const sesionId = "00000000-0000-4000-8000-000000000003"
const autorId = "00000000-0000-4000-8000-000000000004"

function entorno(nombre: string, apellidos: string | null) {
  const findMany = jest.fn(
    async (consulta: { include: { autor: { select: { apellidos?: boolean } } } }) => [
      {
        id,
        clienteId,
        sesionId,
        tipo: "entrenamiento_enviado",
        autor: {
          id: autorId,
          nombre,
          ...(consulta.include.autor.select.apellidos && { apellidos }),
          rol: "cliente",
        },
        sesion: {
          version: 1,
          prescripcion: {
            nombre: "Fuerza",
            ejercicios: [
              {
                id,
                ejercicioId: id,
                nombre: "Sentadilla",
                indicaciones: null,
                rir: { min: 2, max: 2 },
                series: [{ id, tipoMedicion: "repeticiones", repeticiones: 8, pesoKg: 40 }],
              },
            ],
          },
        },
        creadaEn: new Date("2026-10-29T10:00:00Z"),
        lecturas: [],
      },
    ],
  )
  const count = jest.fn(async (_consulta: unknown) => 1)
  const prisma = {
    usuario: { findFirst: async () => ({ id: clienteId }) },
    novedadEntrenamiento: { findMany, count },
  }
  return {
    servicio: new NovedadesService(
      prisma as unknown as PrismaService,
      { comprobarAcceso: () => undefined } as unknown as SesionesService,
    ),
    findMany,
    count,
  }
}

describe("NovedadesService.listar", () => {
  it("excluye los avisos históricos de revisión del listado y sus dos contadores", async () => {
    const { servicio, findMany, count } = entorno("Lara", null)
    await servicio.listar({ sub: clienteId, rol: "cliente", sid: "sesion" }, clienteId, {
      limite: 10,
      desplazamiento: 0,
    })

    const donde = expect.objectContaining({ tipo: { not: "sesion_revisada" } })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: donde }))
    expect(count).toHaveBeenCalledTimes(2)
    for (const [consulta] of count.mock.calls) expect(consulta).toEqual({ where: donde })
  })

  it.each<[string, string | null, string]>([
    ["Lara", "García Pérez", "Lara García Pérez"],
    ["Lara García Pérez", null, "Lara García Pérez"],
    ["Lara", null, "Lara"],
    ["n".repeat(80), "a".repeat(120), `${"n".repeat(59)}…${"a".repeat(60)}`],
  ])(
    "identifica al autor con el nombre y apellidos disponibles (%s)",
    async (nombre, apellidos, esperado) => {
      const { servicio, findMany } = entorno(nombre, apellidos)
      const listado = await servicio.listar(
        { sub: autorId, rol: "entrenador", sid: "sesion" },
        clienteId,
        { limite: 10, desplazamiento: 0 },
      )

      expect(listado.novedades[0]!.autor).toEqual({
        id: autorId,
        nombre: esperado,
        rol: "cliente",
      })
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            autor: { select: { id: true, nombre: true, apellidos: true, rol: true } },
          }),
        }),
      )
    },
  )
})
