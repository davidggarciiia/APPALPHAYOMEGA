import type { ResumenUsuario } from "@alpha-omega/shared"

import { crearApiEntrenamiento } from "../entrenamiento/api"
import { listarUsuarios } from "../lib/api"
import { cargarTrabajo } from "./cargar-trabajo"

jest.mock("../lib/api", () => ({ listarUsuarios: jest.fn() }))
jest.mock("../entrenamiento/api", () => ({ crearApiEntrenamiento: jest.fn() }))

const clientes: ResumenUsuario[] = Array.from({ length: 12 }, (_, n) => ({
  id: `cliente-${n}`,
  nombre: `Cliente ${n}`,
  apellidos: null,
  email: `${n}@example.com`,
  rol: "cliente",
  estado: "activo",
}))
const api = {
  plan: jest.fn(async () => ({ plan: null })),
  resultados: jest.fn(async (_id: string, _limite?: number) => ({
    resultados: [{ resultado: { sesionId: "sesion" } }],
  })),
  leerEntrenador: jest.fn(async () => ({ revisadaEn: null })),
}
const pedir = jest.fn(async () => ({ molestias: [], total: 0 }))

beforeEach(() => {
  jest.mocked(crearApiEntrenamiento).mockReturnValue(api as never)
  jest.mocked(listarUsuarios).mockImplementation(async (_pedir, filtros) => ({
    usuarios:
      filtros.estado === "activo"
        ? clientes
        : clientes.map((c) => ({ ...c, estado: "pendiente" as const })),
    total: 50,
  }))
})

it("acota incluso una respuesta sobredimensionada a 4 activos, 8 activaciones y 18 llamadas", async () => {
  const datos = await cargarTrabajo(pedir as never, 4, 8)
  expect(listarUsuarios).toHaveBeenCalledTimes(2)
  expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
    rol: "cliente",
    estado: "activo",
    limite: 4,
    desde: 4,
  })
  expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
    rol: "cliente",
    estado: "pendiente",
    limite: 8,
    desde: 8,
  })
  expect(datos.clientes).toHaveLength(4)
  expect(datos.pendientes.usuarios).toHaveLength(8)
  expect(api.plan).toHaveBeenCalledTimes(4)
  expect(api.resultados).toHaveBeenCalledTimes(4)
  expect(api.leerEntrenador).toHaveBeenCalledTimes(4)
  expect(pedir).toHaveBeenCalledTimes(4)
  for (const [id, limite] of api.resultados.mock.calls) {
    expect(id).toMatch(/^cliente-/)
    expect(limite).toBe(1)
  }
  for (const [ruta] of pedir.mock.calls as unknown as string[][])
    expect(ruta).toContain("molestias?estado=abierta&limite=3&desplazamiento=0")
})

it("no inventa Sin revisar cuando el servidor no expone el estado de revisión", async () => {
  api.leerEntrenador.mockResolvedValueOnce({ revisadaEn: undefined } as never)
  await expect(cargarTrabajo(pedir as never, 0, 0)).rejects.toThrow("revisión")
})

it("no pide revisión si el cliente nunca ha enviado una sesión", async () => {
  api.resultados.mockResolvedValue({ resultados: [] })
  const datos = await cargarTrabajo(pedir as never, 0, 0)
  expect(api.leerEntrenador).not.toHaveBeenCalled()
  expect(datos.clientes.every((c) => c.sesion === null)).toBe(true)
})
