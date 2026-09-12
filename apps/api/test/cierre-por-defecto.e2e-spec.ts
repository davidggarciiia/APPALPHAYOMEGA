import { Controller, Get, Req, type INestApplication } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { Roles } from "../src/identity/roles.decorator.js"
import type { PeticionAutenticada } from "../src/identity/peticion.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-cierre.test"
const EMAIL = `cliente${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-cierre"

/**
 * Controlador de prueba para la primera capa de permisos: la autenticacion.
 *
 * Declara roles porque la segunda capa, la de autorizacion, deniega toda ruta
 * que no lo haga. El caso de la ruta sin declarar se comprueba en
 * matriz-roles.e2e-spec.ts.
 *
 * Si algun dia estas rutas respondieran sin sesion, el cierre por defecto se
 * habria roto y todo lo que venga detras naceria abierto sin que nadie se entere.
 */
@Controller("ruta-que-nadie-protegio")
class ControladorDescuidado {
  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Get()
  responder(): { visible: boolean } {
    return { visible: true }
  }

  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Get("quien-soy")
  quienSoy(@Req() peticion: PeticionAutenticada): { sub?: string; rol?: string } {
    return { sub: peticion.usuario?.sub, rol: peticion.usuario?.rol }
  }
}

describe("Cierre por defecto", () => {
  let app: INestApplication
  let prisma: PrismaService
  let jwt: JwtService
  let tokenValido: string
  let idDelUsuario: string

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ControladorDescuidado],
    }).compile()

    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    jwt = app.get(JwtService)

    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    const creado = await prisma.usuario.create({
      data: {
        email: EMAIL,
        nombre: "Prueba",
        passwordHash: await cifrarContrasena(CONTRASENA),
        rol: "cliente",
        estado: "activo",
      },
    })
    idDelUsuario = creado.id

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: CONTRASENA })
      .expect(200)

    tokenValido = login.body.tokenAcceso
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("un endpoint nuevo deniega sin sesion", async () => {
    await request(app.getHttpServer()).get("/ruta-que-nadie-protegio").expect(401)
  })

  it("ese mismo endpoint responde con una sesion valida", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio")
      .set("Authorization", `Bearer ${tokenValido}`)
      .expect(200)

    expect(respuesta.body).toEqual({ visible: true })
  })

  it("rechaza un token manipulado", async () => {
    const manipulado = `${tokenValido.slice(0, -4)}AAAA`

    await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio")
      .set("Authorization", `Bearer ${manipulado}`)
      .expect(401)
  })

  it("rechaza un token firmado con otro secreto", async () => {
    const ajeno = new JwtService({ secret: "un-secreto-que-no-es-el-nuestro" }).sign({
      sub: idDelUsuario,
      rol: "entrenador",
    })

    await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio")
      .set("Authorization", `Bearer ${ajeno}`)
      .expect(401)
  })

  it("rechaza un token nuestro cuyo contenido no tiene la forma esperada", async () => {
    // Firmado por nosotros, asi que la firma es valida, pero el rol no existe.
    const raro = jwt.sign({ sub: idDelUsuario, rol: "administrador-supremo" })

    await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio")
      .set("Authorization", `Bearer ${raro}`)
      .expect(401)
  })

  it("ignora un esquema de autorizacion que no sea Bearer", async () => {
    await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio")
      .set("Authorization", `Basic ${tokenValido}`)
      .expect(401)
  })

  it("el rol sale del token, no de una cabecera que mande el cliente", async () => {
    const respuesta = await request(app.getHttpServer())
      .get("/ruta-que-nadie-protegio/quien-soy")
      .set("Authorization", `Bearer ${tokenValido}`)
      .set("X-Rol", "entrenador")
      .set("rol", "entrenador")
      .expect(200)

    // El usuario del token es cliente. Si aqui apareciera entrenador, cualquiera
    // se ascenderia a si mismo con una cabecera.
    expect(respuesta.body.rol).toBe("cliente")
    expect(respuesta.body.sub).toBe(idDelUsuario)
  })

  it("las rutas marcadas como publicas siguen abiertas", async () => {
    await request(app.getHttpServer()).get("/salud").expect(200)

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: "mal" })
      .expect(401)
  })
})
