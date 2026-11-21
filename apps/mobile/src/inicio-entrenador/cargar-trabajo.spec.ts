import type { ResumenUsuario } from "@alpha-omega/shared"

import { listarUsuarios } from "../lib/api"
import { cargarTrabajo } from "./cargar-trabajo"

jest.mock("../lib/api", () => ({ listarUsuarios: jest.fn() }))

const pendientes: ResumenUsuario[] = Array.from({ length: 12 }, (_, n) => ({
  id: `cliente-${n}`,
  nombre: `Cliente ${n}`,
  apellidos: null,
  email: `${n}@example.com`,
  rol: "cliente",
  estado: "pendiente",
}))
const pedir = jest.fn()

beforeEach(() => {
  jest.mocked(listarUsuarios).mockResolvedValue({ usuarios: pendientes, total: 50 })
})

it("pide una sola página de pendientes y acota incluso una respuesta sobredimensionada", async () => {
  const datos = await cargarTrabajo(pedir as never, 8)
  expect(listarUsuarios).toHaveBeenCalledTimes(1)
  expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
    rol: "cliente",
    estado: "pendiente",
    limite: 8,
    desde: 8,
  })
  expect(datos.pendientes.usuarios).toHaveLength(8)
  expect(datos.pendientes.total).toBe(50)
  expect(pedir).not.toHaveBeenCalled()
})
