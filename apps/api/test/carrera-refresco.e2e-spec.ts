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
 * Rotacion de tokens de refresco.
 *
 * La garantia que se protege aqui es que **una familia nunca tiene mas de un
 * token vivo**. Da igual cuantas peticiones lleguen a la vez o cuantas respuestas
 * se pierdan por el camino: si en algun momento hubiera dos tokens validos de la
 * misma sesion, la rotacion habria dejado de servir para lo que existe.
 *
 * Hay una excepcion medida y deliberada: un canje repetido en los primeros
 * segundos se trata como un reintento, no como un robo. Sin eso, un movil al que
 * el sistema mata a mitad de la rotacion deja al cliente fuera de su cuenta.
 */
describe("Rotacion del token de refresco", () => {
  let app: INestApplication
  let prisma: PrismaService

  async function entrar(): Promise<{ tokenAcceso: string; tokenRefresco: string }> {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: CONTRASENA })
      .expect(200)

    return respuesta.body
  }

  function refrescar(token: string): request.Test {
    return request(app.getHttpServer()).post("/auth/refresh").send({ tokenRefresco: token })
  }

  /** Cuantos tokens siguen vivos en toda la cuenta. */
  async function vivos(): Promise<number> {
    const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL } })
    return prisma.tokenRefresco.count({
      where: { usuarioId: usuario?.id ?? "", revocadoEn: null },
    })
  }

  /** Envejece la revocacion de un token para sacarlo de la ventana de gracia. */
  async function envejecer(token: string): Promise<void> {
    await prisma.tokenRefresco.updateMany({
      where: { id: token.split(".")[0] ?? "" },
      data: { revocadoEn: new Date(Date.now() - 60 * 60 * 1000) },
    })
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
        nombre: "Prueba",
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

  it("tras rotar queda exactamente un token vivo", async () => {
    const sesion = await entrar()
    expect(await vivos()).toBe(1)

    const renovada = await refrescar(sesion.tokenRefresco).expect(200)

    expect(renovada.body.tokenRefresco).not.toBe(sesion.tokenRefresco)
    expect(await vivos()).toBe(1)
  })

  it("cuatro canjes simultaneos no bifurcan la sesion", async () => {
    const sesion = await entrar()

    const respuestas = await Promise.all(
      Array.from({ length: 4 }, () => refrescar(sesion.tokenRefresco)),
    )

    // Alguna pudo atenderse como reintento, pero el resultado que importa es que
    // no quedan dos sesiones paralelas.
    expect(respuestas.every((r) => r.status === 200 || r.status === 401)).toBe(true)
    expect(await vivos()).toBe(1)
  })

  it("un canje repetido justo despues se atiende como reintento", async () => {
    const sesion = await entrar()

    // Rotacion legitima cuya respuesta, imaginemos, nunca llego al movil porque
    // el sistema operativo mato la app.
    await refrescar(sesion.tokenRefresco).expect(200)

    // Al reabrir, el movil manda el unico token que tiene: el viejo.
    const reintento = await refrescar(sesion.tokenRefresco).expect(200)

    // Sigue dentro, con un token utilizable, y sin sesiones paralelas.
    expect(await vivos()).toBe(1)
    await refrescar(reintento.body.tokenRefresco).expect(200)
  })

  it("pasada la ventana de gracia, el token viejo corta la cadena entera", async () => {
    const sesion = await entrar()
    const renovada = await refrescar(sesion.tokenRefresco).expect(200)

    // Un token que reaparece una hora despues no es una respuesta perdida: es una
    // copia. No se sabe quien tiene el bueno, asi que se echa a los dos.
    await envejecer(sesion.tokenRefresco)

    await refrescar(sesion.tokenRefresco).expect(401)
    await refrescar(renovada.body.tokenRefresco).expect(401)
    expect(await vivos()).toBe(0)
  })

  it("cerrar sesion no admite ninguna indulgencia", async () => {
    const sesion = await entrar()

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(204)

    // Aunque sea el mismo instante. Un boton de cerrar sesion que deja la sesion
    // viva treinta segundos es una mentira, no una comodidad.
    await refrescar(sesion.tokenRefresco).expect(401)
    expect(await vivos()).toBe(0)
  })

  it("el token de refresco nunca se guarda en claro", async () => {
    const sesion = await entrar()
    const secreto = sesion.tokenRefresco.split(".")[1] ?? ""

    const filas = await prisma.tokenRefresco.findMany()

    expect(filas.some((fila) => fila.hash.includes(secreto))).toBe(false)
  })

  it("la cadena hereda su fecha de nacimiento en cada rotacion", async () => {
    const sesion = await entrar()
    const idInicial = sesion.tokenRefresco.split(".")[0] ?? ""
    const primera = await prisma.tokenRefresco.findUnique({ where: { id: idInicial } })

    const renovada = await refrescar(sesion.tokenRefresco).expect(200)
    const idNuevo = String(renovada.body.tokenRefresco).split(".")[0] ?? ""
    const segunda = await prisma.tokenRefresco.findUnique({ where: { id: idNuevo } })

    // Misma familia y misma fecha de nacimiento. Sin esto, cada rotacion
    // reiniciaba el contador y una sesion robada duraba para siempre.
    expect(segunda?.familiaId).toBe(primera?.familiaId)
    expect(segunda?.familiaCreadaEn.getTime()).toBe(primera?.familiaCreadaEn.getTime())
  })
})
