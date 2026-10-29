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

it("acota incluso una respuesta sobredimensionada a 4 activos, 8 activaciones y 6 llamadas sin consultar revisión", async () => {
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
  expect(api.resultados).not.toHaveBeenCalled()
  expect(api.leerEntrenador).not.toHaveBeenCalled()
  expect(pedir).not.toHaveBeenCalled()
})

it.each([null, { id: "plan" }])(
  "conserva la detección de planes sin depender de revisión: %s",
  async (plan) => {
    api.plan.mockResolvedValue({ plan } as never)
    api.leerEntrenador.mockRejectedValue(new Error("No disponible"))
    const datos = await cargarTrabajo(pedir as never, 0, 0)
    expect(datos.clientes.every((c) => c.sinPlan === (plan === null))).toBe(true)
    expect(api.resultados).not.toHaveBeenCalled()
    expect(api.leerEntrenador).not.toHaveBeenCalled()
  },
)
