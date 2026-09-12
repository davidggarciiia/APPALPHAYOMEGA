import { UnauthorizedException } from "@nestjs/common"
import type { JwtService } from "@nestjs/jwt"
import type { EstadoUsuario, Rol } from "@alpha-omega/shared"

import type { PrismaService } from "../prisma/prisma.service.js"

import { AuthService } from "./auth.service.js"
import type { TokensRefrescoService } from "./tokens-refresco.service.js"
import { cifrarContrasena } from "./contrasenas.js"

type UsuarioEnBase = {
  id: string
  email: string
  passwordHash: string | null
  rol: Rol
  estado: EstadoUsuario
}

/**
 * Los dobles se declaran con la forma minima que el servicio usa y se convierten
 * al tipo real. Es la alternativa a inventarse interfaces que solo existirian
 * para los tests, que seria peor diseno que una conversion acotada aqui.
 */
function prismaCon(usuario: UsuarioEnBase | null): PrismaService {
  return {
    usuario: { findUnique: () => Promise.resolve(usuario) },
  } as unknown as PrismaService
}

const jwtFalso = {
  signAsync: () => Promise.resolve("token-de-prueba"),
} as unknown as JwtService

const refrescosFalsos = {
  emitir: () => Promise.resolve("id.secreto-de-prueba"),
} as unknown as TokensRefrescoService

const CONTRASENA = "una-contrasena-correcta"

async function usuarioActivo(cambios: Partial<UsuarioEnBase> = {}): Promise<UsuarioEnBase> {
  return {
    id: "u-1",
    email: "entrenador@ejemplo.com",
    passwordHash: await cifrarContrasena(CONTRASENA),
    rol: "entrenador",
    estado: "activo",
    ...cambios,
  }
}

describe("AuthService.iniciarSesion", () => {
  it("devuelve una sesion con las credenciales correctas", async () => {
    const servicio = new AuthService(prismaCon(await usuarioActivo()), jwtFalso, refrescosFalsos)

    const sesion = await servicio.iniciarSesion({
      email: "entrenador@ejemplo.com",
      contrasena: CONTRASENA,
    })

    expect(sesion.tokenAcceso).toBe("token-de-prueba")
    expect(sesion.usuario).toEqual({
      id: "u-1",
      email: "entrenador@ejemplo.com",
      rol: "entrenador",
    })
  })

  it("nunca incluye el hash de la contrasena en la sesion", async () => {
    const servicio = new AuthService(prismaCon(await usuarioActivo()), jwtFalso, refrescosFalsos)

    const sesion = await servicio.iniciarSesion({
      email: "entrenador@ejemplo.com",
      contrasena: CONTRASENA,
    })

    expect(JSON.stringify(sesion)).not.toContain("argon2")
    expect(JSON.stringify(sesion)).not.toContain("passwordHash")
  })

  it("rechaza una contrasena incorrecta", async () => {
    const servicio = new AuthService(prismaCon(await usuarioActivo()), jwtFalso, refrescosFalsos)

    await expect(
      servicio.iniciarSesion({ email: "entrenador@ejemplo.com", contrasena: "equivocada" }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("rechaza un correo desconocido con el mismo error que una contrasena mala", async () => {
    const conUsuario = new AuthService(prismaCon(await usuarioActivo()), jwtFalso, refrescosFalsos)
    const sinUsuario = new AuthService(prismaCon(null), jwtFalso, refrescosFalsos)

    const errorPorContrasena = await conUsuario
      .iniciarSesion({ email: "entrenador@ejemplo.com", contrasena: "equivocada" })
      .catch((e: unknown) => e)
    const errorPorCorreo = await sinUsuario
      .iniciarSesion({ email: "nadie@ejemplo.com", contrasena: CONTRASENA })
      .catch((e: unknown) => e)

    expect(errorPorCorreo).toBeInstanceOf(UnauthorizedException)
    expect((errorPorCorreo as UnauthorizedException).message).toBe(
      (errorPorContrasena as UnauthorizedException).message,
    )
  })

  it("no deja entrar a un usuario pendiente aunque acierte la contrasena", async () => {
    const pendiente = await usuarioActivo({ estado: "pendiente" })
    const servicio = new AuthService(prismaCon(pendiente), jwtFalso, refrescosFalsos)

    await expect(
      servicio.iniciarSesion({ email: pendiente.email, contrasena: CONTRASENA }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("no deja entrar a un usuario desactivado aunque acierte la contrasena", async () => {
    const desactivado = await usuarioActivo({ estado: "desactivado" })
    const servicio = new AuthService(prismaCon(desactivado), jwtFalso, refrescosFalsos)

    await expect(
      servicio.iniciarSesion({ email: desactivado.email, contrasena: CONTRASENA }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("no deja entrar a un usuario sin contrasena fijada", async () => {
    const sinContrasena = await usuarioActivo({ passwordHash: null, estado: "pendiente" })
    const servicio = new AuthService(prismaCon(sinContrasena), jwtFalso, refrescosFalsos)

    await expect(
      servicio.iniciarSesion({ email: sinContrasena.email, contrasena: "lo-que-sea" }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
