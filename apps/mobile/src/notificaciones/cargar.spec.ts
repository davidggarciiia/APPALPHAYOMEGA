import type { UsuarioPublico } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { listarUsuarios } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { cargarNotificaciones } from "./cargar"

jest.mock("../lib/api", () => ({ listarUsuarios: jest.fn() }))

const pedir = jest.fn() as unknown as PeticionAutenticada
const entrenamiento = {
  novedades: jest.fn(async () => ({ novedades: [], total: 0, sinLeer: 2 })),
} as unknown as ApiEntrenamiento
const seguimiento = { avisos: jest.fn(async () => ({ avisos: [], sinLeer: 1 })) }

it("el cliente consulta solo sus avisos sin enumerar otras cuentas", async () => {
  const cuenta = { id: "cliente", nombre: "Lucía", apellidos: "Pérez", rol: "cliente" }
  const buzones = await cargarNotificaciones(
    cuenta as UsuarioPublico,
    pedir,
    entrenamiento,
    seguimiento,
  )
  expect(listarUsuarios).not.toHaveBeenCalled()
  expect(entrenamiento.novedades).toHaveBeenCalledWith("cliente", 0)
  expect(seguimiento.avisos).toHaveBeenCalledWith("cliente")
  expect(buzones[0]).toMatchObject({ id: "cliente", nombre: "Lucía Pérez" })
})

it("el entrenador incluye clientes posteriores a la primera página y sus nombres completos", async () => {
  const clientes = Array.from({ length: 101 }, (_, i) => ({
    id: String(i),
    nombre: "Lucía",
    apellidos: `Pérez ${i}`,
    rol: "cliente" as const,
    email: `${i}@prueba.local`,
    estado: "activo" as const,
  }))
  jest.mocked(listarUsuarios).mockImplementation(async (_pedir, filtros) => ({
    usuarios: clientes.slice(filtros.desde, filtros.desde + filtros.limite),
    total: clientes.length,
  }))
  const buzones = await cargarNotificaciones(
    { rol: "entrenador" } as UsuarioPublico,
    pedir,
    entrenamiento,
    seguimiento,
  )
  expect(listarUsuarios).toHaveBeenLastCalledWith(pedir, {
    rol: "cliente",
    limite: 100,
    desde: 100,
  })
  expect(buzones).toHaveLength(101)
  expect(buzones[100]).toMatchObject({ id: "100", nombre: "Lucía Pérez 100" })
  expect(entrenamiento.novedades).toHaveBeenCalledWith("100", 0)
  expect(
    buzones.reduce((total, b) => total + b.entrenamiento.sinLeer + b.seguimiento.sinLeer, 0),
  ).toBe(303)
})

it("un fallo no se presenta como una bandeja vacía", async () => {
  seguimiento.avisos.mockRejectedValueOnce(new Error("Sin red"))
  await expect(
    cargarNotificaciones(
      { id: "cliente", rol: "cliente" } as UsuarioPublico,
      pedir,
      entrenamiento,
      seguimiento,
    ),
  ).rejects.toThrow("Sin red")
})

it("deja de recorrer la cartera al abandonar la consulta, antes de abrir el siguiente lote", async () => {
  const controlador = new AbortController()
  const clientes = Array.from({ length: 8 }, (_, i) => ({
    id: String(i),
    nombre: "Lara",
    apellidos: "García",
    rol: "cliente" as const,
    email: `${i}@prueba.local`,
    estado: "activo" as const,
  }))
  jest.mocked(listarUsuarios).mockResolvedValue({ usuarios: clientes, total: clientes.length })
  const api = {
    novedades: jest.fn(async () => {
      controlador.abort()
      return { novedades: [], total: 0, sinLeer: 0 }
    }),
  }
  await expect(
    cargarNotificaciones(
      { rol: "entrenador" } as UsuarioPublico,
      pedir,
      api,
      seguimiento,
      controlador.signal,
    ),
  ).rejects.toThrow("Consulta cancelada")
  expect(api.novedades).toHaveBeenCalledTimes(4)
})
