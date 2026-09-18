import { z } from "zod"
import { crearPeticionAutenticada } from "./peticion-autenticada"
import { ErrorDeSesion } from "./http"

jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
const respuesta = (): Response => new Response(JSON.stringify({ ok: true }))
const esquema = z.object({ ok: z.boolean() })

describe("Renovación coordinada de peticiones", () => {
  const fetchMock = jest.spyOn(globalThis, "fetch")
  afterEach(() => fetchMock.mockReset())
  it("renueva una sola vez para dos 401 concurrentes y reintenta con el mismo cuerpo", async () => {
    let token = "viejo"
    const renovar = jest.fn(async () => {
      token = "nuevo"
      return token
    })
    fetchMock.mockImplementation(async (_ruta, opciones) =>
      new Headers(opciones?.headers).get("Authorization") === "Bearer viejo"
        ? new Response(null, { status: 401 })
        : respuesta(),
    )
    const pedir = crearPeticionAutenticada(() => token, { renovar, epoca: () => 0 })
    const body = JSON.stringify({ operacionId: "10000000-0000-4000-8000-000000000000", valor: 3 })
    await Promise.all([pedir("/uno", esquema), pedir("/dos", esquema, { method: "POST", body })])
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(
      fetchMock.mock.calls
        .filter(([ruta]) => String(ruta).endsWith("/dos"))
        .map(([, opciones]) => opciones?.body),
    ).toEqual([body, body])
  })
  it("no repite automáticamente una mutación sin operación estable", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    const renovar = jest.fn(async () => "nuevo")
    const pedir = crearPeticionAutenticada(() => "viejo", { renovar, epoca: () => 0 })
    await expect(pedir("/ejercicios", esquema, { method: "POST", body: "{}" })).rejects.toThrow(
      /reintenta/i,
    )
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("una salida durante la renovación impide reintentar y entregar la respuesta anterior", async () => {
    let epoca = 0
    let completar: (token: string) => void = () => undefined
    let avisar: () => void = () => undefined
    const dentro = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const renovar = jest.fn(() => {
      avisar()
      return new Promise<string>((resolve) => {
        completar = resolve
      })
    })
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    const pedir = crearPeticionAutenticada(() => "viejo", { renovar, epoca: () => epoca })
    const resultado = pedir("/sesiones", esquema)
    const rechazo = expect(resultado).rejects.toBeInstanceOf(ErrorDeSesion)
    await dentro
    epoca++
    completar("nuevo")
    await rechazo
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
