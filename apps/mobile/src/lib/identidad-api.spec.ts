import {
  listarUsuarios,
  leerUsuario,
  leerAsignaciones,
  listarMisClientes,
  crearUsuario,
  guardarUsuario,
  corregirCorreo,
  reenviarActivacion,
  desactivarUsuario,
  reactivarUsuario,
  asignarCliente,
  retirarCliente,
} from "./api"
import { crearPeticionAutenticada, type PeticionAutenticada } from "./peticion-autenticada"

jest.mock("./direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
const fetchMock = jest.spyOn(globalThis, "fetch")
afterEach(() => fetchMock.mockReset())
const ficha = {
  id: "cliente",
  email: "demo@prueba.local",
  nombre: "Lara",
  apellidos: null,
  rol: "cliente",
  estado: "activo",
  telefono: null,
  fechaNacimiento: null,
  creadoEn: "2026-10-01T10:00:00.000Z",
  tieneContrasena: true,
}
const lecturas: Array<[string, (pedir: PeticionAutenticada) => Promise<unknown>, unknown]> = [
  [
    "cartera",
    (pedir) => listarUsuarios(pedir, { limite: 100, desde: 0 }),
    { usuarios: [], total: 0 },
  ],
  ["ficha", (pedir) => leerUsuario(pedir, "cliente"), ficha],
  [
    "asignaciones",
    (pedir) => leerAsignaciones(pedir, "nutri"),
    { nutricionistaId: "nutri", clienteIds: [] },
  ],
  ["mis clientes", listarMisClientes, { usuarios: [], total: 0 }],
]
it.each(lecturas)(
  "renueva una lectura de %s con acceso caducado",
  async (_nombre, consultar, respuesta) => {
    let token = "viejo"
    const renovar = jest.fn(async () => (token = "nuevo"))
    const pedir = crearPeticionAutenticada(() => token, { renovar, epoca: () => 0 })
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(respuesta)))
    await expect(consultar(pedir)).resolves.toEqual(respuesta)
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer nuevo",
    )
  },
)
const escrituras: Array<[string, (pedir: PeticionAutenticada) => Promise<unknown>]> = [
  [
    "alta",
    (pedir) => crearUsuario(pedir, { nombre: "Lara", email: "demo@prueba.local", rol: "cliente" }),
  ],
  ["contacto", (pedir) => guardarUsuario(pedir, "cliente", { nombre: "Lara" })],
  ["correo", (pedir) => corregirCorreo(pedir, "cliente", "demo@prueba.local")],
  ["activación", (pedir) => reenviarActivacion(pedir, "cliente")],
  ["baja", (pedir) => desactivarUsuario(pedir, "cliente")],
  ["reactivación", (pedir) => reactivarUsuario(pedir, "cliente")],
  ["asignar", (pedir) => asignarCliente(pedir, "nutri", "cliente")],
  ["retirar", (pedir) => retirarCliente(pedir, "nutri", "cliente")],
]
it.each(escrituras)(
  "renueva %s y exige confirmar la escritura sin repetirla",
  async (_nombre, escribir) => {
    let token = "viejo"
    const renovar = jest.fn(async () => (token = "nuevo"))
    const pedir = crearPeticionAutenticada(() => token, { renovar, epoca: () => 0 })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    await expect(escribir(pedir)).rejects.toThrow(/reintenta/i)
    expect(renovar).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  },
)
