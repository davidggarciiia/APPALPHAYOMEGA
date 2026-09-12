import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-carrera.test"
const EMAIL = `usuario${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-carrera"

/**
 * La rotacion tenia una carrera: entre leer la fila y marcarla revocada cabian
 * dos peticiones simultaneas, y las dos salian con una sesion valida. El
 * resultado era una sesion bifurcada en dos cadenas, que es exactamente lo que
 * la rotacion pretendia impedir.
 *
 * El arreglo convierte la revocacion en una escritura condicional, asi que la
 * base arbitra y solo una peticion gana.
 */
describe("Carrera en el canje del token de refresco", () => {
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
  })

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await prisma.usuario.create({
      data: {
        email: EMAIL,
        passwordHash: await cifrarContrasena(CONTRASENA),
        rol: "cliente",
        estado: "activo",
      },
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("cuatro canjes simultaneos del mismo token: solo uno gana", async () => {
    const sesion = await entrar()

    const respuestas = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app.getHttpServer())
          .post("/auth/refresh")
          .send({ tokenRefresco: sesion.tokenRefresco }),
      ),
    )

    const correctas = respuestas.filter((r) => r.status === 200)
    const rechazadas = respuestas.filter((r) => r.status === 401)

    expect(correctas).toHaveLength(1)
    expect(rechazadas).toHaveLength(3)
  })

  it("reutilizar un token ya rotado corta la cadena entera", async () => {
    const sesion = await entrar()

    // Rotacion legitima.
    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    // Alguien usa la copia vieja. Eso solo pasa si un token se ha copiado.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)

    // Como no se sabe quien tiene el token bueno, se corta la familia entera y
    // se obliga a volver a escribir la contrasena. Es lo unico seguro.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: renovada.body.tokenRefresco })
      .expect(401)
  })

  it("todas las filas de la familia quedan revocadas tras detectar el reuso", async () => {
    const sesion = await entrar()

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)

    const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL } })
    const vivas = await prisma.tokenRefresco.count({
      where: { usuarioId: usuario?.id ?? "", revocadoEn: null },
    })

    expect(vivas).toBe(0)
  })

  it("la cadena hereda su fecha de nacimiento en cada rotacion", async () => {
    const sesion = await entrar()
    const idInicial = sesion.tokenRefresco.split(".")[0] ?? ""

    const primera = await prisma.tokenRefresco.findUnique({ where: { id: idInicial } })

    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    const idNuevo = String(renovada.body.tokenRefresco).split(".")[0] ?? ""
    const segunda = await prisma.tokenRefresco.findUnique({ where: { id: idNuevo } })

    // Misma familia y misma fecha de nacimiento. Sin esto, cada rotacion
    // reiniciaba el contador y una sesion robada duraba para siempre.
    expect(segunda?.familiaId).toBe(primera?.familiaId)
    expect(segunda?.familiaCreadaEn.getTime()).toBe(primera?.familiaCreadaEn.getTime())
  })
})
