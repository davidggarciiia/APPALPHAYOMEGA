import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-perfil.test"
const CONTRASENA = "contrasena-de-prueba-perfil"

describe("Perfil propio", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<Rol, string>()
  const ids = new Map<Rol, string>()

  function como(rol: Rol): string {
    return `Bearer ${tokens.get(rol) ?? ""}`
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = modulo.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })

    const passwordHash = await cifrarContrasena(CONTRASENA)
    for (const rol of ROLES) {
      const email = `${rol}${SUFIJO}`
      const creado = await prisma.usuario.create({
        data: { email, nombre: rol, passwordHash, rol, estado: "activo" },
      })
      ids.set(rol, creado.id)

      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, contrasena: CONTRASENA })
        .expect(200)

      tokens.set(rol, login.body.tokenAcceso)
    }
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("los cuatro roles pueden leer su propio perfil", async () => {
    for (const rol of ROLES) {
      const respuesta = await request(app.getHttpServer())
        .get("/perfil")
        .set("Authorization", como(rol))
        .expect(200)

      expect(respuesta.body.id).toBe(ids.get(rol))
      expect(respuesta.body.rol).toBe(rol)
    }
  })

  it("sin sesion no se lee ningun perfil", async () => {
    await request(app.getHttpServer()).get("/perfil").expect(401)
  })

  it("nunca devuelve el hash de la contrasena", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", como("cliente"))
      .expect(200)

    expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash")
    expect(JSON.stringify(respuesta.body)).not.toContain("argon2")
  })

  it("guarda los cambios y los devuelve", async () => {
    const respuesta = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({
        nombre: "Ana",
        apellidos: "García Ruiz",
        telefono: "+34 600 11 22 33",
        fechaNacimiento: "1990-05-17",
      })
      .expect(200)

    expect(respuesta.body.nombre).toBe("Ana")
    expect(respuesta.body.apellidos).toBe("García Ruiz")
    expect(respuesta.body.telefono).toBe("+34 600 11 22 33")
    expect(respuesta.body.fechaNacimiento).toBe("1990-05-17")
  })

  it("la fecha no se desplaza un dia al guardarla y leerla", async () => {
    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ fechaNacimiento: "1990-01-01" })
      .expect(200)

    const leido = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", como("cliente"))
      .expect(200)

    // Guardar la hora de un cumpleanos no significa nada y en Madrid podria
    // mostrarse el 31 de diciembre. Por eso solo se guarda la fecha.
    expect(leido.body.fechaNacimiento).toBe("1990-01-01")
  })

  it("un objeto vacio no borra nada", async () => {
    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ nombre: "Ana", telefono: "600112233" })
      .expect(200)

    const respuesta = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({})
      .expect(200)

    expect(respuesta.body.nombre).toBe("Ana")
    expect(respuesta.body.telefono).toBe("600112233")
  })

  it("enviar null si vacia un campo opcional", async () => {
    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ telefono: "600112233" })
      .expect(200)

    const respuesta = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ telefono: null })
      .expect(200)

    expect(respuesta.body.telefono).toBeNull()
  })

  it("un telefono en blanco se guarda como vacio, no como cadena vacia", async () => {
    const respuesta = await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ telefono: "" })
      .expect(200)

    expect(respuesta.body.telefono).toBeNull()
  })

  it("no se puede cambiar el correo, el rol ni el estado", async () => {
    const antes = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", como("cliente"))
      .expect(200)

    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({
        nombre: "Ana",
        email: "otro@ejemplo.com",
        rol: "entrenador",
        estado: "desactivado",
      })
      .expect(200)

    const despues = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", como("cliente"))
      .expect(200)

    // Cambiar el correo es cambiar de identidad, y sin verificar la direccion
    // nueva cualquiera se apropiaria de la cuenta de otro. Ascenderse solo de
    // rol, ni hablar.
    expect(despues.body.email).toBe(antes.body.email)
    expect(despues.body.rol).toBe("cliente")
    expect(despues.body.estado).toBe("activo")
  })

  it("editar el perfil propio no toca el de nadie mas", async () => {
    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", como("cliente"))
      .send({ nombre: "Solo yo" })
      .expect(200)

    const otro = await request(app.getHttpServer())
      .get("/perfil")
      .set("Authorization", como("entrenador"))
      .expect(200)

    expect(otro.body.nombre).toBe("entrenador")
  })

  it("rechaza datos con la forma equivocada", async () => {
    const cabecera = como("cliente")

    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", cabecera)
      .send({ nombre: "" })
      .expect(400)

    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", cabecera)
      .send({ fechaNacimiento: "17 de mayo de 1990" })
      .expect(400)

    await request(app.getHttpServer())
      .patch("/perfil")
      .set("Authorization", cabecera)
      .send({ telefono: "llámame al fijo" })
      .expect(400)
  })
})
