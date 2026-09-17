import { createHash, randomUUID } from "node:crypto"

import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { SesionSchema, type Sesion, type EstadoUsuario } from "@alpha-omega/shared"

import { AppModule } from "../src/app.module.js"
import { CorreoEnMemoria } from "../src/correo/correo-en-memoria.js"
import { ServicioDeCorreo } from "../src/correo/correo.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { ActivacionService } from "../src/identity/activacion.service.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = `${randomUUID()}@e2e-recuperacion.test`
const CONTRASENA = "la contrasena anterior de prueba"
const NUEVA = "la nueva frase larga de prueba"

function tokenDelCorreo(texto: string): string {
  return decodeURIComponent(/token=([^\s&]+)/.exec(texto)?.[1] ?? "")
}

describe("Recuperacion de contrasena", () => {
  let app: INestApplication
  let prisma: PrismaService
  const correo = new CorreoEnMemoria()

  beforeEach(async () => {
    correo.limpiar()
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ServicioDeCorreo)
      .useValue(correo)
      .compile()
    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  afterEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  async function crear(
    nombre = "ana",
    estado: EstadoUsuario = "activo",
  ): Promise<{ id: string; email: string }> {
    return prisma.usuario.create({
      data: {
        email: `${nombre}-${SUFIJO}`,
        nombre,
        rol: "cliente",
        estado,
        passwordHash: estado === "pendiente" ? null : await cifrarContrasena(CONTRASENA),
      },
    })
  }

  function solicitar(email: string): request.Test {
    return request(app.getHttpServer()).post("/auth/recuperar").send({ email })
  }

  async function enlacePara(email: string): Promise<string> {
    await solicitar(email).expect(204)
    const token = tokenDelCorreo(correo.ultimoPara(email)?.texto ?? "")
    expect(token).not.toBe("")
    return token
  }

  function restablecer(token: string, contrasena = NUEVA): request.Test {
    return request(app.getHttpServer()).post("/auth/restablecer").send({ token, contrasena })
  }

  async function entrar(email: string, contrasena = CONTRASENA): Promise<Sesion> {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, contrasena })
      .expect(200)
    return SesionSchema.parse(respuesta.body)
  }

  it("responde igual exista o no el correo y envia un enlace de una hora solo a la cuenta activa", async () => {
    const email = `activo-${SUFIJO}`
    await prisma.usuario.create({
      data: {
        email,
        nombre: "Ana",
        rol: "cliente",
        estado: "activo",
        passwordHash: await cifrarContrasena(CONTRASENA),
      },
    })

    const existente = await request(app.getHttpServer())
      .post("/auth/recuperar")
      .send({ email })
      .expect(204)
    const desconocido = await request(app.getHttpServer())
      .post("/auth/recuperar")
      .send({ email: `nadie-${SUFIJO}` })
      .expect(204)

    expect(existente.text).toBe(desconocido.text)
    expect(correo.ultimoPara(email)?.texto).toContain("alphaomega://restablecer?token=")
    expect(correo.ultimoPara(email)?.texto).toContain("1 hora")
    expect(correo.ultimoPara(`nadie-${SUFIJO}`)).toBeUndefined()
    expect(await prisma.usuario.count({ where: { email: `nadie-${SUFIJO}` } })).toBe(0)
  })

  it("guarda solo el hash del secreto y caduca en una hora", async () => {
    const usuario = await crear()
    const antes = Date.now()
    const token = await enlacePara(usuario.email)
    const [id, secreto = ""] = token.split(".")
    const fila = await prisma.tokenRecuperacion.findUniqueOrThrow({ where: { id } })
    expect(secreto.length).toBeGreaterThanOrEqual(43)
    expect(fila.hash).toBe(createHash("sha256").update(secreto).digest("hex"))
    expect(fila.hash).not.toBe(secreto)
    expect(fila.expiraEn.getTime()).toBeGreaterThanOrEqual(antes + 60 * 60 * 1000)
    expect(fila.expiraEn.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000)
  })

  it("normaliza correo y no filtra el fallo del proveedor", async () => {
    const usuario = await crear()
    await solicitar(`  ${usuario.email.toUpperCase()}  `).expect(204)
    expect(correo.ultimoPara(usuario.email)).toBeDefined()
    correo.hacerFallarElProximoEnvio()
    const fallo = await solicitar(usuario.email).expect(204)
    const ausente = await solicitar(`ausente-${SUFIJO}`).expect(204)
    expect(fallo.text).toBe(ausente.text)
  })

  it.each(["pendiente", "desactivado"] as const)(
    "no envia recuperacion a una cuenta %s",
    async (estado) => {
      const usuario = await crear("sin-acceso", estado)
      await solicitar(usuario.email).expect(204)
      expect(correo.ultimoPara(usuario.email)).toBeUndefined()
      expect(await prisma.tokenRecuperacion.count({ where: { usuarioId: usuario.id } })).toBe(0)
    },
  )

  it("cambia la contrasena y consume el enlace una sola vez", async () => {
    const usuario = await crear()
    const token = await enlacePara(usuario.email)
    await restablecer(token).expect(204)
    await entrar(usuario.email, NUEVA)
    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: usuario.email, contrasena: CONTRASENA })
      .expect(401)
    await restablecer(token, "otra nueva contrasena").expect(400)
    await entrar(usuario.email, NUEVA)
  })

  it("rechaza del mismo modo enlaces usados, caducados, inventados y secretos incorrectos", async () => {
    const usuario = await crear()
    const token = await enlacePara(usuario.email)
    const id = token.split(".")[0] ?? ""
    const incorrecto = await restablecer(`${id}.otro-secreto`).expect(400)
    const inventado = await restablecer("inventado.inventado").expect(400)
    const incompleto = await restablecer("sin-separador").expect(400)
    await prisma.tokenRecuperacion.update({
      where: { id },
      data: { expiraEn: new Date(Date.now() - 1) },
    })
    const caducado = await restablecer(token).expect(400)
    await prisma.tokenRecuperacion.update({
      where: { id },
      data: { expiraEn: new Date(Date.now() + 60_000), usadoEn: new Date() },
    })
    const usado = await restablecer(token).expect(400)
    for (const respuesta of [inventado, incompleto, caducado, usado])
      expect(respuesta.body).toEqual(incorrecto.body)
    await entrar(usuario.email)
  })

  it("pedir otro enlace invalida el anterior", async () => {
    const usuario = await crear()
    const antiguo = await enlacePara(usuario.email)
    const nuevo = await enlacePara(usuario.email)
    expect(nuevo).not.toBe(antiguo)
    await restablecer(antiguo).expect(400)
    await restablecer(nuevo).expect(204)
  })

  it("dos solicitudes simultaneas dejan un unico enlace vigente", async () => {
    const usuario = await crear()
    await Promise.all([solicitar(usuario.email).expect(204), solicitar(usuario.email).expect(204)])
    expect(
      await prisma.tokenRecuperacion.count({ where: { usuarioId: usuario.id, usadoEn: null } }),
    ).toBe(1)
    const respuestas = await Promise.all(
      correo.enviados.map((mensaje) => restablecer(tokenDelCorreo(mensaje.texto))),
    )
    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([204, 400])
  })

  it("dos canjes simultaneos consumen el enlace exactamente una vez", async () => {
    const usuario = await crear()
    const token = await enlacePara(usuario.email)
    const contrasenas = [NUEVA, "otra frase larga simultanea"]
    const respuestas = await Promise.all(
      contrasenas.map((contrasena) => restablecer(token, contrasena)),
    )
    expect(respuestas.map((respuesta) => respuesta.status).sort()).toEqual([204, 400])
    const ganadora =
      contrasenas[respuestas.findIndex((respuesta) => respuesta.status === 204)] ?? ""
    await entrar(usuario.email, ganadora)
  })

  it.each(["pendiente", "desactivado"] as const)(
    "un enlace previo no cambia ni activa una cuenta que ahora esta %s",
    async (estado) => {
      const usuario = await crear()
      const token = await enlacePara(usuario.email)
      await prisma.usuario.update({ where: { id: usuario.id }, data: { estado } })
      await restablecer(token).expect(400)
      expect((await prisma.usuario.findUniqueOrThrow({ where: { id: usuario.id } })).estado).toBe(
        estado,
      )
    },
  )

  it("activacion y recuperacion no aceptan los tokens del otro flujo", async () => {
    const pendiente = await crear("pendiente", "pendiente")
    await app.get(ActivacionService).enviarEnlace(pendiente.id)
    await restablecer(tokenDelCorreo(correo.ultimoPara(pendiente.email)?.texto ?? "")).expect(400)
    const activo = await crear()
    const recuperacion = await enlacePara(activo.email)
    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token: recuperacion, contrasena: NUEVA })
      .expect(400)
    await restablecer(recuperacion).expect(204)
  })

  it("cierra todas las sesiones abiertas y la gracia de sus tokens ya rotados", async () => {
    const usuario = await crear()
    const primera = await entrar(usuario.email)
    const segunda = await entrar(usuario.email)
    const rotada = SesionSchema.parse(
      (
        await request(app.getHttpServer())
          .post("/auth/refresh")
          .send({ tokenRefresco: primera.tokenRefresco })
          .expect(200)
      ).body,
    )
    const token = await enlacePara(usuario.email)
    await restablecer(token).expect(204)
    for (const sesion of [primera, segunda, rotada]) {
      await request(app.getHttpServer())
        .get("/perfil")
        .set("Authorization", `Bearer ${sesion.tokenAcceso}`)
        .expect(401)
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ tokenRefresco: sesion.tokenRefresco })
        .expect(401)
    }
    expect(
      await prisma.tokenRefresco.count({ where: { usuarioId: usuario.id, revocadoEn: null } }),
    ).toBe(0)
    await entrar(usuario.email, NUEVA)
  })

  it("limita solicitudes sin revelar si el correo existe", async () => {
    const usuario = await crear()
    for (let intento = 0; intento < 10; intento += 1) await solicitar(usuario.email).expect(204)
    expect(correo.enviados.length).toBeLessThanOrEqual(6)
    expect(correo.enviados.length).toBeGreaterThan(0)
    await solicitar(`inexistente-${SUFIJO}`).expect(204)
  })

  it("limita los canjes fallidos por origen aunque cambie el token", async () => {
    for (let intento = 0; intento < 6; intento += 1)
      await restablecer(`inventado.${intento}`).expect(400)
    await restablecer("otro-inventado.distinto").expect(429)
  })

  it("valida correo, contrasena y token antes de escribir", async () => {
    await solicitar("no-es-un-correo").expect(400)
    const usuario = await crear()
    const token = await enlacePara(usuario.email)
    await restablecer(token, "corta").expect(400)
    await restablecer("", NUEVA).expect(400)
    await restablecer("x".repeat(501)).expect(400)
    await restablecer(token).expect(204)
  })
})
