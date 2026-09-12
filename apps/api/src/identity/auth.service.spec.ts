import { UnauthorizedException } from "@nestjs/common"
import type { JwtService } from "@nestjs/jwt"
import type { EstadoUsuario, Rol } from "@alpha-omega/shared"

import type { PrismaService } from "../prisma/prisma.service.js"

import { AuthService } from "./auth.service.js"
import { LimitadorDeIntentos } from "./limitador-intentos.service.js"
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
  emitir: () => Promise.resolve({ token: "id.secreto-de-prueba", id: "id" }),
} as unknown as TokensRefrescoService

const CONTRASENA = "una-contrasena-correcta"
const ORIGEN = "127.0.0.1"

function servicioCon(usuario: UsuarioEnBase | null): AuthService {
  // Un limitador nuevo por test: si se compartiera, los fallos de un caso
  // bloquearian al siguiente y los tests dependerian de su orden.
  return new AuthService(prismaCon(usuario), jwtFalso, refrescosFalsos, new LimitadorDeIntentos())
}

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
    const servicio = servicioCon(await usuarioActivo())

    const sesion = await servicio.iniciarSesion(
      {
        email: "entrenador@ejemplo.com",
        contrasena: CONTRASENA,
      },
      ORIGEN,
    )

    expect(sesion.tokenAcceso).toBe("token-de-prueba")
    expect(sesion.usuario).toEqual({
      id: "u-1",
      email: "entrenador@ejemplo.com",
      rol: "entrenador",
    })
  })

  it("nunca incluye el hash de la contrasena en la sesion", async () => {
    const servicio = servicioCon(await usuarioActivo())

    const sesion = await servicio.iniciarSesion(
      {
        email: "entrenador@ejemplo.com",
        contrasena: CONTRASENA,
      },
      ORIGEN,
    )

    expect(JSON.stringify(sesion)).not.toContain("argon2")
    expect(JSON.stringify(sesion)).not.toContain("passwordHash")
  })

  it("rechaza una contrasena incorrecta", async () => {
    const servicio = servicioCon(await usuarioActivo())

    await expect(
      servicio.iniciarSesion({ email: "entrenador@ejemplo.com", contrasena: "equivocada" }, ORIGEN),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("rechaza un correo desconocido con el mismo error que una contrasena mala", async () => {
    const conUsuario = servicioCon(await usuarioActivo())
    const sinUsuario = servicioCon(null)

    const errorPorContrasena = await conUsuario
      .iniciarSesion({ email: "entrenador@ejemplo.com", contrasena: "equivocada" }, ORIGEN)
      .catch((e: unknown) => e)
    const errorPorCorreo = await sinUsuario
      .iniciarSesion({ email: "nadie@ejemplo.com", contrasena: CONTRASENA }, ORIGEN)
      .catch((e: unknown) => e)

    expect(errorPorCorreo).toBeInstanceOf(UnauthorizedException)
    expect((errorPorCorreo as UnauthorizedException).message).toBe(
      (errorPorContrasena as UnauthorizedException).message,
    )
  })

  it("no deja entrar a un usuario pendiente aunque acierte la contrasena", async () => {
    const pendiente = await usuarioActivo({ estado: "pendiente" })
    const servicio = servicioCon(pendiente)

    await expect(
      servicio.iniciarSesion({ email: pendiente.email, contrasena: CONTRASENA }, ORIGEN),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("no deja entrar a un usuario desactivado aunque acierte la contrasena", async () => {
    const desactivado = await usuarioActivo({ estado: "desactivado" })
    const servicio = servicioCon(desactivado)

    await expect(
      servicio.iniciarSesion({ email: desactivado.email, contrasena: CONTRASENA }, ORIGEN),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it("no deja entrar a un usuario sin contrasena fijada", async () => {
    const sinContrasena = await usuarioActivo({ passwordHash: null, estado: "pendiente" })
    const servicio = servicioCon(sinContrasena)

    await expect(
      servicio.iniciarSesion({ email: sinContrasena.email, contrasena: "lo-que-sea" }, ORIGEN),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
