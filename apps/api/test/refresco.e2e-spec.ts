import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-refresco.test"
const EMAIL = `usuario${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-refresco"

describe("Ciclo de sesion: login, refresh y logout", () => {
  let app: INestApplication
  let prisma: PrismaService

  async function entrar(): Promise<{ tokenAcceso: string; tokenRefresco: string }> {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: CONTRASENA })
      .expect(200)

    return respuesta.body
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await prisma.usuario.create({
      data: {
        email: EMAIL,
        nombre: "Prueba",
        passwordHash: await cifrarContrasena(CONTRASENA),
        rol: "entrenador",
        estado: "activo",
      },
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("el login devuelve los dos tokens", async () => {
    const sesion = await entrar()

    expect(typeof sesion.tokenAcceso).toBe("string")
    expect(typeof sesion.tokenRefresco).toBe("string")
    expect(sesion.tokenRefresco).toContain(".")
  })

  it("refresh devuelve una sesion nueva", async () => {
    const sesion = await entrar()

    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    expect(typeof renovada.body.tokenAcceso).toBe("string")
    expect(renovada.body.usuario.email).toBe(EMAIL)
  })

  it("logout revoca el token y el refresco posterior falla", async () => {
    const sesion = await entrar()

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(204)

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)
  })

  it("un token de refresco caducado no renueva", async () => {
    const sesion = await entrar()
    const id = sesion.tokenRefresco.split(".")[0] ?? ""

    await prisma.tokenRefresco.update({
      where: { id },
      data: { expiraEn: new Date(Date.now() - 1000) },
    })

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)
  })

  it("un identificador valido con el secreto equivocado no renueva", async () => {
    const sesion = await entrar()
    const id = sesion.tokenRefresco.split(".")[0] ?? ""

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: `${id}.secreto-inventado` })
      .expect(401)
  })

  it("un token inventado entero no renueva", async () => {
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: "esto-no-existe.ni-esto" })
      .expect(401)

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: "sin-punto-siquiera" })
      .expect(401)
  })

  it("un usuario desactivado despues de entrar no puede renovar", async () => {
    const sesion = await entrar()

    await prisma.usuario.update({
      where: { email: EMAIL },
      data: { estado: "desactivado" },
    })

    // Aunque el token de refresco siga siendo valido, el estado manda: se
    // relee el usuario en cada renovacion precisamente para esto.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)

    await prisma.usuario.update({
      where: { email: EMAIL },
      data: { estado: "activo" },
    })
  })
})
