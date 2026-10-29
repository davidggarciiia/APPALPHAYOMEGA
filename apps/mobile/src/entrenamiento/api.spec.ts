import type { Molestia } from "@alpha-omega/shared"

import { crearPeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiEntrenamiento } from "./api"

jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

function molestia(numero: number): Molestia {
  return {
    id: `60000000-0000-4000-8000-${String(numero).padStart(12, "0")}`,
    sesionId: "20000000-0000-4000-8000-000000000000",
    clienteId: "30000000-0000-4000-8000-000000000000",
    ejercicioPrescritoId: null,
    ejercicio: null,
    serie: null,
    zona: "hombro",
    intensidad: 7,
    sintomas: [],
    nivel: "rojo",
    nota: null,
    creadaEn: "2026-10-28T10:00:00.000Z",
    estado: "abierta",
    respuesta: null,
    atendidaEn: null,
  }
}

const fetchMock = jest.spyOn(globalThis, "fetch")
const api = crearApiEntrenamiento(crearPeticionAutenticada(() => "token-vigente"))
afterEach(() => fetchMock.mockReset())

it("incluye las molestias antiguas de otras páginas conservando filtro y autenticación", async () => {
  const primera = Array.from({ length: 100 }, (_, i) => molestia(i))
  const antigua = molestia(100)
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ molestias: primera, total: 101 })))
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ molestias: [antigua], total: 101 })),
  )
  await expect(api.molestias("cliente/uno", "abierta")).resolves.toEqual({
    molestias: [...primera, antigua],
    total: 101,
  })
  expect(fetchMock).toHaveBeenCalledTimes(2)
  for (const [i, [url, opciones]] of fetchMock.mock.calls.entries()) {
    const consulta = new URL(String(url))
    expect(consulta.pathname).toBe("/entrenamiento/clientes/cliente%2Funo/molestias")
    expect(consulta.searchParams.get("estado")).toBe("abierta")
    expect(consulta.searchParams.get("limite")).toBe("100")
    expect(consulta.searchParams.get("desplazamiento")).toBe(String(i * 100))
    expect(new Headers(opciones?.headers).get("Authorization")).toBe("Bearer token-vigente")
  }
})

it("rechaza una lectura incompleta en lugar de declarar que no quedan molestias", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ molestias: [molestia(0)], total: 2 })),
  )
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ molestias: [], total: 2 })))
  await expect(api.molestias("cliente")).rejects.toThrow("cargar todas las molestias")
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("no duplica una molestia que cambia de página durante la lectura", async () => {
  const primera = molestia(0)
  const antigua = molestia(1)
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ molestias: [primera], total: 2 })))
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ molestias: [primera, antigua], total: 2 })),
  )
  await expect(api.molestias("cliente")).resolves.toEqual({
    molestias: [primera, antigua],
    total: 2,
  })
})

it("propaga el fallo de una página posterior sin devolver un historial parcial", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ molestias: [molestia(0)], total: 2 })),
  )
  fetchMock.mockRejectedValueOnce(new TypeError("Sin conexión"))
  await expect(api.molestias("cliente")).rejects.toThrow()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
