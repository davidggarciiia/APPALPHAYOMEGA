import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { CorreoEnMemoria } from "../src/correo/correo-en-memoria.js"
import { ServicioDeCorreo } from "../src/correo/correo.service.js"
import { ActivacionService } from "../src/identity/activacion.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-alta.test"
const CONTRASENA_ADMIN = "contrasena-del-entrenador"
const CONTRASENA_NUEVA = "una frase larga que recuerdo"

/** Saca el token del enlace que va dentro del correo. */
function tokenDelCorreo(texto: string): string {
  const encontrado = /token=([^\s&]+)/.exec(texto)
  return decodeURIComponent(encontrado?.[1] ?? "")
}

describe("Alta directa y activacion", () => {
  let app: INestApplication
  let prisma: PrismaService
  const correo = new CorreoEnMemoria()
  const tokens = new Map<Rol, string>()

  function comoEntrenador(): request.Test {
    return request(app.getHttpServer())
      .post("/usuarios")
      .set("Authorization", `Bearer ${tokens.get("entrenador") ?? ""}`)
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      // Sin esto los tests enviarian correos de verdad.
      .overrideProvider(ServicioDeCorreo)
      .useValue(correo)
      .compile()

    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    correo.limpiar()
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })

    // Una cuenta activa por rol, para comprobar quien puede dar de alta.
    const passwordHash = await cifrarContrasena(CONTRASENA_ADMIN)
    for (const rol of ROLES) {
      const email = `admin-${rol}${SUFIJO}`
      await prisma.usuario.create({
        data: { email, nombre: rol, passwordHash, rol, estado: "activo" },
      })

      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, contrasena: CONTRASENA_ADMIN })
        .expect(200)

      tokens.set(rol, login.body.tokenAcceso)
    }
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("solo el entrenador puede dar de alta", async () => {
    for (const rol of ROLES) {
      const esperado = rol === "entrenador" ? 201 : 403

      await request(app.getHttpServer())
        .post("/usuarios")
        .set("Authorization", `Bearer ${tokens.get(rol) ?? ""}`)
        .send({ email: `nuevo-${rol}${SUFIJO}`, nombre: "Ana", rol: "cliente" })
        .expect(esperado)
    }
  })

  it("sin sesion no se puede dar de alta", async () => {
    await request(app.getHttpServer())
      .post("/usuarios")
      .send({ email: `sin-sesion${SUFIJO}`, nombre: "Ana", rol: "cliente" })
      .expect(401)
  })

  it("el perfil nace pendiente y sin contrasena", async () => {
    const email = `ana${SUFIJO}`

    const respuesta = await comoEntrenador()
      .send({ email, nombre: "Ana", apellidos: "Garcia", rol: "cliente" })
      .expect(201)

    expect(respuesta.body.estado).toBe("pendiente")
    expect(respuesta.body.nombre).toBe("Ana")
    expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash")

    const enBase = await prisma.usuario.findUnique({ where: { email } })
    expect(enBase?.passwordHash).toBeNull()
  })

  it("un perfil pendiente no puede iniciar sesion", async () => {
    const email = `pendiente${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Luis", rol: "cliente" }).expect(201)

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, contrasena: CONTRASENA_NUEVA })
      .expect(401)
  })

  it("el alta envia un correo con un enlace de activacion", async () => {
    const email = `conenlace${SUFIJO}`
    const respuesta = await comoEntrenador()
      .send({ email, nombre: "Marta", rol: "cliente" })
      .expect(201)

    expect(respuesta.body.correoEnviado).toBe(true)

    const mensaje = correo.ultimoPara(email)
    expect(mensaje).toBeDefined()
    expect(mensaje?.asunto).toContain("Activa tu cuenta")
    expect(mensaje?.texto).toContain("Marta")
    expect(tokenDelCorreo(mensaje?.texto ?? "")).not.toBe("")
  })

  it("si el correo falla, la cuenta se conserva y la respuesta lo dice", async () => {
    const email = `sincorreo${SUFIJO}`
    correo.hacerFallarElProximoEnvio()

    const respuesta = await comoEntrenador()
      .send({ email, nombre: "Pedro", rol: "cliente" })
      .expect(201)

    // La cuenta existe: el entrenador acaba de teclear los datos con la persona
    // delante y perderla por un fallo del proveedor seria peor.
    expect(await prisma.usuario.findUnique({ where: { email } })).not.toBeNull()

    // Y no se le miente: sabe que tiene que reenviar el enlace.
    expect(respuesta.body.correoEnviado).toBe(false)
  })

  it("activar fija la contrasena y deja entrar", async () => {
    const email = `activable${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Carlos", rol: "cliente" }).expect(201)

    const token = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: CONTRASENA_NUEVA })
      .expect(204)

    const enBase = await prisma.usuario.findUnique({ where: { email } })
    expect(enBase?.estado).toBe("activo")

    const sesion = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, contrasena: CONTRASENA_NUEVA })
      .expect(200)

    expect(sesion.body.usuario.nombre).toBe("Carlos")
  })

  it("el mismo enlace no sirve dos veces", async () => {
    const email = `unsolouso${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Sara", rol: "cliente" }).expect(201)
    const token = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: CONTRASENA_NUEVA })
      .expect(204)

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: "otra frase completamente distinta" })
      .expect(400)
  })

  it("un enlace caducado no activa", async () => {
    const email = `caducado${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Jose", rol: "cliente" }).expect(201)
    const token = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")

    await prisma.tokenActivacion.update({
      where: { id: token.split(".")[0] ?? "" },
      data: { expiraEn: new Date(Date.now() - 1000) },
    })

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: CONTRASENA_NUEVA })
      .expect(400)
  })

  it("un enlace inventado no activa", async () => {
    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: "no-existe.ni-de-lejos", contrasena: CONTRASENA_NUEVA })
      .expect(400)

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: "sin-punto", contrasena: CONTRASENA_NUEVA })
      .expect(400)
  })

  it("un identificador valido con el secreto equivocado no activa", async () => {
    const email = `secretomal${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Eva", rol: "cliente" }).expect(201)
    const id = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "").split(".")[0] ?? ""

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: `${id}.secreto-inventado`, contrasena: CONTRASENA_NUEVA })
      .expect(400)
  })

  it("rechaza una contrasena demasiado corta", async () => {
    const email = `corta${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Rai", rol: "cliente" }).expect(201)
    const token = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: "corta" })
      .expect(400)

    // Y el enlace sigue sirviendo: rechazar la contrasena no puede gastar el
    // unico enlace que esa persona tiene.
    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: CONTRASENA_NUEVA })
      .expect(204)
  })

  it("reenviar el alta invalida el enlace anterior", async () => {
    const email = `reenviado${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Nuria", rol: "cliente" }).expect(201)
    const primerToken = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    await app.get(ActivacionService).enviarEnlace(usuario?.id ?? "")

    const segundoToken = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")
    expect(segundoToken).not.toBe(primerToken)

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: primerToken, contrasena: CONTRASENA_NUEVA })
      .expect(400)

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: segundoToken, contrasena: CONTRASENA_NUEVA })
      .expect(204)
  })

  it("no deja crear dos cuentas con el mismo correo", async () => {
    const email = `repetido${SUFIJO}`
    await comoEntrenador().send({ email, nombre: "Uno", rol: "cliente" }).expect(201)
    await comoEntrenador().send({ email, nombre: "Dos", rol: "cliente" }).expect(409)
  })

  it("rechaza un cuerpo que no tiene la forma esperada", async () => {
    await comoEntrenador()
      .send({ email: "no-es-un-correo", nombre: "X", rol: "cliente" })
      .expect(400)
    await comoEntrenador()
      .send({ email: `x${SUFIJO}`, nombre: "", rol: "cliente" })
      .expect(400)
    await comoEntrenador()
      .send({ email: `x${SUFIJO}`, nombre: "X", rol: "jefe" })
      .expect(400)
  })
})
