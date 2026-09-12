import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-login.test"
const EMAIL_ACTIVO = `activo${SUFIJO}`
const EMAIL_PENDIENTE = `pendiente${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-e2e"

/**
 * Estos tests van contra la base de datos real, no contra dobles. Crean sus
 * propios usuarios con un dominio de correo reconocible y los borran al
 * terminar, para no dejar basura ni pisar datos de desarrollo.
 */
describe("POST /auth/login", () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })

    const passwordHash = await cifrarContrasena(CONTRASENA)
    await prisma.usuario.createMany({
      data: [
        { email: EMAIL_ACTIVO, passwordHash, rol: "entrenador", estado: "activo" },
        { email: EMAIL_PENDIENTE, passwordHash, rol: "cliente", estado: "pendiente" },
      ],
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("devuelve token y usuario con credenciales correctas", async () => {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL_ACTIVO, contrasena: CONTRASENA })
      .expect(200)

    expect(typeof respuesta.body.tokenAcceso).toBe("string")
    expect(respuesta.body.tokenAcceso.length).toBeGreaterThan(20)
    expect(respuesta.body.usuario.email).toBe(EMAIL_ACTIVO)
    expect(respuesta.body.usuario.rol).toBe("entrenador")
  })

  it("nunca devuelve el hash de la contrasena", async () => {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL_ACTIVO, contrasena: CONTRASENA })
      .expect(200)

    const cuerpo = JSON.stringify(respuesta.body)
    expect(cuerpo).not.toContain("passwordHash")
    expect(cuerpo).not.toContain("argon2")
  })

  it("responde 401 con la contrasena equivocada", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL_ACTIVO, contrasena: "esta-no-es" })
      .expect(401)
  })

  it("responde exactamente lo mismo ante un correo que no existe", async () => {
    const porContrasena = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL_ACTIVO, contrasena: "esta-no-es" })
      .expect(401)

    const porCorreo = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: `fantasma${SUFIJO}`, contrasena: CONTRASENA })
      .expect(401)

    // Si estos dos cuerpos difirieran, cualquiera podria averiguar que correos
    // tienen cuenta probandolos uno a uno.
    expect(porCorreo.body).toEqual(porContrasena.body)
  })

  it("no deja entrar a un usuario pendiente aunque la contrasena sea correcta", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL_PENDIENTE, contrasena: CONTRASENA })
      .expect(401)
  })

  it("responde 400 si el cuerpo no tiene la forma esperada", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "esto-no-es-un-correo", contrasena: "x" })
      .expect(400)

    await request(app.getHttpServer()).post("/auth/login").send({}).expect(400)
  })

  it("no delata el valor recibido en el error de validacion", async () => {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: "no-valido", contrasena: "secreto-que-no-debe-aparecer" })
      .expect(400)

    expect(JSON.stringify(respuesta.body)).not.toContain("secreto-que-no-debe-aparecer")
  })
})
