import { guardarPerfil, leerPerfil } from "./api"
import { crearPeticionAutenticada } from "./peticion-autenticada"

jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
const perfil = {
  id: "cliente",
  email: "demo@prueba.local",
  nombre: "Cliente",
  apellidos: null,
  rol: "cliente",
  estado: "activo",
  telefono: null,
  fechaNacimiento: null,
  fotoUrl: null,
}
const fetchMock = jest.spyOn(globalThis, "fetch")
afterEach(() => fetchMock.mockReset())

it("renueva el acceso caducado para leer el perfil", async () => {
  let token = "viejo"
  const renovar = jest.fn(async () => {
    token = "nuevo"
    return token
  })
  fetchMock
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(perfil)))
  const pedir = crearPeticionAutenticada(() => token, { renovar, epoca: () => 0 })
  await expect(leerPerfil(pedir)).resolves.toEqual(perfil)
  expect(renovar).toHaveBeenCalledTimes(1)
  expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe(
    "Bearer nuevo",
  )
})

it("renueva al guardar pero espera un reintento explícito antes de repetir el PATCH", async () => {
  let token = "viejo"
  const renovar = jest.fn(async () => {
    token = "nuevo"
    return token
  })
  fetchMock
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(perfil)))
  const pedir = crearPeticionAutenticada(() => token, { renovar, epoca: () => 0 })
  await expect(guardarPerfil(pedir, { nombre: "Cliente" })).rejects.toThrow(/reintenta/i)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await expect(guardarPerfil(pedir, { nombre: "Cliente" })).resolves.toEqual(perfil)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})
