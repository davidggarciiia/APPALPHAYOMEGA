import { Controller, Get, type INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { Roles } from "../src/identity/roles.decorator.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-revocacion.test"
const EMAIL = `usuario${SUFIJO}`
const CONTRASENA = "contrasena-de-prueba-revocacion"

@Controller("zona-protegida")
class ZonaProtegida {
  @Roles("cliente", "entrenador", "nutricionista", "empleado")
  @Get()
  cualquiera(): string {
    return "ok"
  }

  @Roles("entrenador")
  @Get("solo-entrenador")
  soloEntrenador(): string {
    return "ok"
  }
}

/**
 * Estos tests cubren el agujero que encontro la auditoria adversarial: un token
 * de acceso firmado seguia abriendo puertas despues de cerrar sesion, despues de
 * desactivar la cuenta y despues de degradar el rol, porque nadie lo contrastaba
 * contra la base de datos.
 *
 * En una app con datos de salud y un nutricionista subcontratado entre los
 * usuarios, ese hueco era la diferencia entre cortar un acceso y creer que lo
 * has cortado.
 */
describe("Revocacion efectiva del token de acceso", () => {
  let app: INestApplication
  let prisma: PrismaService

  async function entrar(): Promise<{ tokenAcceso: string; tokenRefresco: string }> {
    const respuesta = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: EMAIL, contrasena: CONTRASENA })
      .expect(200)

    return respuesta.body
  }

  function conToken(token: string, ruta = "/zona-protegida"): request.Test {
    return request(app.getHttpServer()).get(ruta).set("Authorization", `Bearer ${token}`)
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ZonaProtegida],
    }).compile()

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
        rol: "entrenador",
        estado: "activo",
      },
    })
  })

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("cerrar sesion invalida el token de acceso al instante", async () => {
    const sesion = await entrar()
    await conToken(sesion.tokenAcceso).expect(200)

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(204)

    // Antes del arreglo esto devolvia 200 durante quince minutos.
    await conToken(sesion.tokenAcceso).expect(401)
  })

  it("desactivar la cuenta invalida el token de acceso al instante", async () => {
    const sesion = await entrar()
    await conToken(sesion.tokenAcceso).expect(200)

    await prisma.usuario.update({ where: { email: EMAIL }, data: { estado: "desactivado" } })

    // Este es el caso del nutricionista al que se le corta el contrato.
    await conToken(sesion.tokenAcceso).expect(401)
  })

  it("borrar la cuenta invalida el token de acceso al instante", async () => {
    const sesion = await entrar()
    await conToken(sesion.tokenAcceso).expect(200)

    await prisma.usuario.deleteMany({ where: { email: EMAIL } })

    await conToken(sesion.tokenAcceso).expect(401)
  })

  it("degradar el rol surte efecto en la siguiente peticion", async () => {
    const sesion = await entrar()
    await conToken(sesion.tokenAcceso, "/zona-protegida/solo-entrenador").expect(200)

    await prisma.usuario.update({ where: { email: EMAIL }, data: { rol: "cliente" } })

    // El token sigue diciendo "entrenador", pero manda la base de datos.
    await conToken(sesion.tokenAcceso, "/zona-protegida/solo-entrenador").expect(403)
    await conToken(sesion.tokenAcceso).expect(200)
  })

  it("refrescar corta la sesion anterior, no abre una paralela", async () => {
    const sesion = await entrar()

    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    // El token de acceso viejo pertenece a una fila ya revocada por la rotacion.
    await conToken(sesion.tokenAcceso).expect(401)
    await conToken(renovada.body.tokenAcceso).expect(200)
  })

  it("cerrar sesion apaga tambien la gracia del token recien rotado", async () => {
    const sesion = await entrar()

    // Rotar es lo que hace la app nada mas abrirse, asi que este es el estado
    // normal de un movil un segundo antes de que alguien pulse cerrar sesion.
    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    await request(app.getHttpServer())
      .post("/auth/logout")
      .send({ tokenRefresco: renovada.body.tokenRefresco })
      .expect(204)

    // El token ANTERIOR quedo revocado por rotacion hace un instante, dentro de
    // la ventana de gracia. Si cerrar sesion no apagara esa ventana, este canje
    // abriria una sesion nueva despues del cierre: cerrar sesion no cerraria
    // nada durante treinta segundos, que es justo cuando le da a alguien tiempo
    // de usar un token copiado.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)

    // Y el de la sesion cerrada tampoco, por si acaso.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: renovada.body.tokenRefresco })
      .expect(401)
  })

  it("un reuso detectado apaga la gracia de toda la familia", async () => {
    const sesion = await entrar()

    const renovada = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    // Segundo canje del viejo: entra por la gracia y se consume. Es el
    // reintento legitimo de un movil que perdio la respuesta.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(200)

    // Tercero: ya no hay gracia que valga, y la familia entera queda cortada.
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: sesion.tokenRefresco })
      .expect(401)

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ tokenRefresco: renovada.body.tokenRefresco })
      .expect(401)
  })
})
