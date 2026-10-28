import { jest } from "@jest/globals"

const variables: Record<string, string> = {}
let existente: { rol: string } | null = null
const crear = jest.fn(async (_datos: unknown) => ({}))
const desconectar = jest.fn(async () => undefined)
const cifrar = jest.fn(async (_texto: string) => "hash-sintetico")

jest.unstable_mockModule("@prisma/adapter-pg", () => ({ PrismaPg: class {} }))
jest.unstable_mockModule("@prisma/client", () => ({
  PrismaClient: class {
    usuario = { findUnique: async () => existente, create: crear }
    $disconnect = desconectar
  },
}))
jest.unstable_mockModule("./config/entorno.js", () => ({
  leerVariable: (nombre: string) => {
    const valor = variables[nombre]
    if (valor === undefined) throw new Error(`Falta ${nombre}`)
    return valor
  },
}))
jest.unstable_mockModule("./config/postgres.js", () => ({
  urlDeConexion: () => "postgresql://synthetic:synthetic@db.example.invalid/synthetic",
}))
jest.unstable_mockModule("./identity/contrasenas.js", () => ({ cifrarContrasena: cifrar }))

describe("cuenta inicial sin conexiones ni contraseñas reales", () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    existente = null
    for (const nombre of Object.keys(variables)) delete variables[nombre]
    variables.SEED_ENTRENADOR_EMAIL = "entrenador@example.invalid"
    variables.SEED_ENTRENADOR_PASSWORD = "contrasena-sintetica-larga"
    jest.spyOn(console, "log").mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it("rechaza una contraseña corta antes de cifrar o crear una cuenta privilegiada", async () => {
    variables.SEED_ENTRENADOR_PASSWORD = "x"
    await expect(import("./seed.js")).rejects.toThrow()
    expect(cifrar).not.toHaveBeenCalled()
    expect(crear).not.toHaveBeenCalled()
    expect(desconectar).toHaveBeenCalledTimes(1)
  })

  it("rechaza un correo inválido sin crear la cuenta", async () => {
    variables.SEED_ENTRENADOR_EMAIL = "no-es-un-correo"
    await expect(import("./seed.js")).rejects.toThrow()
    expect(crear).not.toHaveBeenCalled()
    expect(desconectar).toHaveBeenCalledTimes(1)
  })

  it("no anuncia éxito si ese correo pertenece a un cliente", async () => {
    existente = { rol: "cliente" }
    await expect(import("./seed.js")).rejects.toThrow("entrenador")
    expect(crear).not.toHaveBeenCalled()
    expect(desconectar).toHaveBeenCalledTimes(1)
  })

  it("conserva al entrenador existente sin pedir ni cambiar su contraseña", async () => {
    existente = { rol: "entrenador" }
    delete variables.SEED_ENTRENADOR_PASSWORD
    await import("./seed.js")
    expect(crear).not.toHaveBeenCalled()
    expect(cifrar).not.toHaveBeenCalled()
  })

  it("crea la cuenta nueva con correo normalizado y hash", async () => {
    variables.SEED_ENTRENADOR_EMAIL = " ENTRENADOR@EXAMPLE.INVALID "
    await import("./seed.js")
    expect(crear).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "entrenador@example.invalid",
        passwordHash: "hash-sintetico",
        rol: "entrenador",
        estado: "activo",
      }),
    })
    expect(desconectar).toHaveBeenCalledTimes(1)
  })
})
