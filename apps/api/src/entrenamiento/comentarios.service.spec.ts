import { jest } from "@jest/globals"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { SesionesService } from "./sesiones.service.js"
import { ComentariosService } from "./comentarios.service.js"

const id = "00000000-0000-4000-8000-000000000001"
const clienteId = "00000000-0000-4000-8000-000000000002"
const sesionId = "00000000-0000-4000-8000-000000000003"
const autorId = "00000000-0000-4000-8000-000000000004"

describe("ComentariosService.listar", () => {
  it.each<[string, string | null, string]>([
    ["Carlos", "García Pérez", "Carlos García Pérez"],
    ["Carlos García Pérez", null, "Carlos García Pérez"],
    ["Carlos", null, "Carlos"],
    ["n".repeat(80), "a".repeat(120), `${"n".repeat(80)} ${"a".repeat(120)}`],
  ])(
    "identifica al autor del comentario con sus apellidos (%s)",
    async (nombre, apellidos, esperado) => {
      const findMany = jest.fn(
        async (consulta: { include: { autor: { select: { apellidos?: boolean } } } }) => [
          {
            id,
            sesionId,
            texto: "Buena sesión",
            ejercicioPrescritoId: null,
            ejercicio: null,
            autor: {
              id: autorId,
              nombre,
              ...(consulta.include.autor.select.apellidos && { apellidos }),
              rol: "entrenador",
            },
            creadoEn: new Date("2026-10-29T10:00:00Z"),
          },
        ],
      )
      const servicio = new ComentariosService(
        { comentarioSesion: { findMany } } as unknown as PrismaService,
        { fila: async () => ({}) } as unknown as SesionesService,
      )

      const listado = await servicio.listar(
        { sub: clienteId, rol: "cliente", sid: "sesion" },
        sesionId,
      )

      expect(listado.comentarios[0]!.autor).toEqual({
        id: autorId,
        nombre: esperado,
        rol: "entrenador",
      })
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { autor: { select: { id: true, nombre: true, apellidos: true, rol: true } } },
        }),
      )
    },
  )
})
