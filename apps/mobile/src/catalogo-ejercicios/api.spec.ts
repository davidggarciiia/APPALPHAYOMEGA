import { jest } from "@jest/globals"
import { CrearEjercicioSchema } from "@alpha-omega/shared"
import { crearApiDeCatalogo, ErrorDeNombreDuplicado } from "./api"
import { crearPeticionAutenticada } from "../lib/peticion-autenticada"

jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))

describe("Catálogo conectado a HTTP", () => {
  const fetchMock = jest.spyOn(globalThis, "fetch")
  afterEach(() => {
    fetchMock.mockReset()
  })
  const api = crearApiDeCatalogo(crearPeticionAutenticada(() => "token-vigente"))

  it("serializa los filtros y valida el listado que llega de la API", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ejercicios: [], total: 0 })))
    await expect(api.buscar({ buscar: "press & remo", grupo: "pecho" })).resolves.toEqual({
      ejercicios: [],
      total: 0,
    })
    const [url, opciones] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain("buscar=press+%26+remo")
    expect(new Headers(opciones?.headers).get("Authorization")).toBe("Bearer token-vigente")
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ejercicios: [], total: "incorrecto" })),
    )
    await expect(api.buscar({})).rejects.toThrow()
  })

  it("traduce el nombre duplicado y mantiene el resto de los fallos", async () => {
    const datos = CrearEjercicioSchema.parse({
      nombre: "Remo",
      grupoPrincipal: "espalda",
      gruposSecundarios: [],
      instrucciones: "Controla el recorrido",
    })
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ statusCode: 409, codigo: "nombre_duplicado", message: "Duplicado" }),
        { status: 409 },
      ),
    )
    await expect(api.crear(datos)).rejects.toBeInstanceOf(ErrorDeNombreDuplicado)
    fetchMock.mockRejectedValueOnce(new TypeError("Sin conexión"))
    await expect(
      api.editar("11111111-1111-4111-8111-111111111111", datos),
    ).rejects.not.toBeInstanceOf(ErrorDeNombreDuplicado)
  })
})
