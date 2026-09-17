import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { Rol } from "@alpha-omega/shared"
import { ROLES } from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { CorreoEnMemoria } from "../src/correo/correo-en-memoria.js"
import { ServicioDeCorreo } from "../src/correo/correo.service.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-gestion.test"
const CONTRASENA_ADMIN = "contrasena-del-entrenador"
const CONTRASENA_NUEVA = "una frase larga que recuerdo"
const ID_INEXISTENTE = "00000000-0000-4000-8000-000000000000"

/** Saca el token del enlace que va dentro del correo. */
function tokenDelCorreo(texto: string): string {
  const encontrado = /token=([^\s&]+)/.exec(texto)
  return decodeURIComponent(encontrado?.[1] ?? "")
}

describe("Gestion de clientes", () => {
  let app: INestApplication
  let prisma: PrismaService
  const correo = new CorreoEnMemoria()
  const tokens = new Map<Rol, string>()
  const identificadores = new Map<Rol, string>()

  function como(rol: Rol): string {
    return `Bearer ${tokens.get(rol) ?? ""}`
  }

  /** Da de alta a alguien por la via de verdad: el endpoint de la tarea 12. */
  async function crearCliente(
    nombre: string,
    etiqueta: string,
  ): Promise<{ id: string; email: string }> {
    const email = `${etiqueta}${SUFIJO}`
    const respuesta = await request(app.getHttpServer())
      .post("/usuarios")
      .set("Authorization", como("entrenador"))
      .send({ email, nombre, rol: "cliente" })
      .expect(201)

    return { id: respuesta.body.id, email }
  }

  /** Alta y activacion completas, para tener a alguien que si puede entrar. */
  async function crearClienteActivo(
    nombre: string,
    etiqueta: string,
  ): Promise<{ id: string; email: string }> {
    const cliente = await crearCliente(nombre, etiqueta)
    const token = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")

    await request(app.getHttpServer())
      .post("/auth/activar")
      .send({ token, contrasena: CONTRASENA_NUEVA })
      .expect(204)

    return cliente
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

    const passwordHash = await cifrarContrasena(CONTRASENA_ADMIN)
    for (const rol of ROLES) {
      const email = `admin-${rol}${SUFIJO}`
      const creado = await prisma.usuario.create({
        data: { email, nombre: rol, passwordHash, rol, estado: "activo" },
      })
      identificadores.set(rol, creado.id)

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

  describe("la baja impide entrar", () => {
    it("la baja tambien cierra la gracia de un refresco ya rotado", async () => {
      const cliente = await crearClienteActivo("Rotado", "baja-rotado")
      const sesion = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ tokenRefresco: sesion.body.tokenRefresco })
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)
      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ tokenRefresco: sesion.body.tokenRefresco })
        .expect(401)
    })

    it("corregir un correo quema el enlace enviado a la direccion anterior", async () => {
      const cliente = await crearCliente("Correo", "correo-equivocado")
      const token = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")

      await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: `correo-corregido${SUFIJO}` })
        .expect(200)

      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token, contrasena: CONTRASENA_NUEVA })
        .expect(400)
      const ficha = await prisma.usuario.findUniqueOrThrow({ where: { id: cliente.id } })
      expect(ficha.estado).toBe("pendiente")
      expect(ficha.passwordHash).toBeNull()
    })

    it("un cliente desactivado no inicia sesion, y no se le dice por que", async () => {
      const cliente = await crearClienteActivo("Ana", "baja-login")

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const rechazo = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(401)

      // Un correo que no existe tiene que responder EXACTAMENTE lo mismo. Decir
      // "cuenta desactivada" convertiria el login en un oraculo de que
      // direcciones son clientes del entrenador.
      const desconocido = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: `nadie${SUFIJO}`, contrasena: CONTRASENA_NUEVA })
        .expect(401)

      expect(rechazo.body).toEqual(desconocido.body)
    })

    it("la baja revoca las sesiones vivas en la base, no solo en apariencia", async () => {
      const cliente = await crearClienteActivo("Luis", "baja-sesiones")

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)

      expect(
        await prisma.tokenRefresco.count({
          where: { usuarioId: cliente.id, revocadoEn: null },
        }),
      ).toBeGreaterThan(0)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Este test mira la base a proposito. El de "no inicia sesion" pasaria en
      // verde aunque no se revocara nada, porque quien corta es el guard al leer
      // el estado. El dia que alguien reactive la cuenta, esas sesiones sin
      // revocar volverian a servir.
      expect(
        await prisma.tokenRefresco.count({
          where: { usuarioId: cliente.id, revocadoEn: null },
        }),
      ).toBe(0)
    })

    it("un token de refresco anterior a la baja sigue muerto despues de reactivar", async () => {
      const cliente = await crearClienteActivo("Marta", "baja-refresco")

      const sesion = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ tokenRefresco: sesion.body.tokenRefresco })
        .expect(401)

      // Y aun asi puede volver a entrar con su contrasena de siempre.
      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)
    })

    it("la baja quema el enlace de activacion vivo", async () => {
      const cliente = await crearCliente("Pedro", "baja-enlace")
      const token = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Sin esto, dar de baja a quien seguia pendiente no serviria de nada: le
      // bastaria abrir el correo que ya tenia para activarse y entrar.
      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token, contrasena: CONTRASENA_NUEVA })
        .expect(400)

      const enBase = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(enBase?.estado).toBe("desactivado")
      expect(enBase?.passwordHash).toBeNull()

      // Que el enlace no active se comprueba arriba, pero eso lo garantizan dos
      // piezas distintas: el quemado de la baja y la condicion de estado dentro
      // de `activar`. Esta linea mira el quemado por separado, para que quitarlo
      // no pueda quedar tapado por la otra.
      expect(
        await prisma.tokenActivacion.count({
          where: { usuarioId: cliente.id, usadoEn: null },
        }),
      ).toBe(0)
    })
  })

  describe("activar solo activa a quien esta pendiente", () => {
    it("un enlace que reviviera por su cuenta tampoco activaria una cuenta de baja", async () => {
      const cliente = await crearCliente("Fantasma", "enlace-resucitado")
      const token = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Se devuelve el enlace a la vida a mano, que es lo que pasaria si algun
      // dia una ruta nueva olvidara quemarlo. La segunda defensa vive dentro de
      // activar: mira el estado del titular, no solo la fila del token.
      await prisma.tokenActivacion.updateMany({
        where: { usuarioId: cliente.id },
        data: { usadoEn: null },
      })

      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token, contrasena: CONTRASENA_NUEVA })
        .expect(400)

      const enBase = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(enBase?.estado).toBe("desactivado")
      expect(enBase?.passwordHash).toBeNull()
    })
  })

  describe("la baja conserva el historico", () => {
    it("los datos siguen existiendo despues de desactivar", async () => {
      const cliente = await crearCliente("Sara", "conserva")

      await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({ apellidos: "Molina", telefono: "600 11 22 33", fechaNacimiento: "1990-05-04" })
        .expect(200)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const ficha = await request(app.getHttpServer())
        .get(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(ficha.body.estado).toBe("desactivado")
      expect(ficha.body.nombre).toBe("Sara")
      expect(ficha.body.apellidos).toBe("Molina")
      expect(ficha.body.telefono).toBe("600 11 22 33")
      expect(ficha.body.fechaNacimiento).toBe("1990-05-04")
      expect(typeof ficha.body.creadoEn).toBe("string")

      expect(await prisma.usuario.count({ where: { id: cliente.id } })).toBe(1)
    })

    it("sigue apareciendo en la cartera, con su estado", async () => {
      const cliente = await crearCliente("Eva", "sigue-en-lista")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const listado = await request(app.getHttpServer())
        .get("/usuarios?estado=desactivado")
        .set("Authorization", como("entrenador"))
        .expect(200)

      const suyo = listado.body.usuarios.find((u: { id: string }) => u.id === cliente.id)
      expect(suyo?.estado).toBe("desactivado")
    })

    it("las filas hijas se revocan, no se borran", async () => {
      const cliente = await crearCliente("Jose", "filas-hijas")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // El modelo borra en cascada. Si alguien colase un delete en lugar de un
      // cambio de estado, estas filas desaparecerian en silencio y con ellas el
      // rastro de quien tuvo acceso a que.
      expect(await prisma.tokenActivacion.count({ where: { usuarioId: cliente.id } })).toBe(1)
    })

    it("no existe ninguna ruta que borre una cuenta", async () => {
      const cliente = await crearCliente("Rai", "sin-borrado")

      await request(app.getHttpServer())
        .delete(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .expect(404)

      expect(await prisma.usuario.count({ where: { id: cliente.id } })).toBe(1)
    })
  })

  describe("reenvio del enlace", () => {
    it("dos reenvios simultaneos dejan un solo enlace utilizable", async () => {
      const cliente = await crearCliente("Doble", "reenvio-simultaneo")
      await Promise.all(
        [0, 1].map(() =>
          request(app.getHttpServer())
            .post(`/usuarios/${cliente.id}/reenviar-activacion`)
            .set("Authorization", como("entrenador"))
            .expect(200),
        ),
      )
      expect(
        await prisma.tokenActivacion.count({
          where: { usuarioId: cliente.id, usadoEn: null },
        }),
      ).toBe(1)
    })

    it("reenviar a la vez que una baja no deja enlaces vivos", async () => {
      const cliente = await crearCliente("Carrera", "reenvio-baja")
      const [reenvio] = await Promise.all([
        request(app.getHttpServer())
          .post(`/usuarios/${cliente.id}/reenviar-activacion`)
          .set("Authorization", como("entrenador")),
        request(app.getHttpServer())
          .post(`/usuarios/${cliente.id}/desactivar`)
          .set("Authorization", como("entrenador"))
          .expect(200),
      ])
      expect([200, 400]).toContain(reenvio.status)
      expect(
        await prisma.tokenActivacion.count({
          where: { usuarioId: cliente.id, usadoEn: null },
        }),
      ).toBe(0)
    })

    it("corregir el correo y activar con el antiguo no pueden triunfar juntos", async () => {
      const cliente = await crearCliente("Carrera", "correo-activacion")
      const token = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")
      const [correccion, activacion] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/usuarios/${cliente.id}/correo`)
          .set("Authorization", como("entrenador"))
          .send({ email: `correo-carrera-corregido${SUFIJO}` }),
        request(app.getHttpServer())
          .post("/auth/activar")
          .send({ token, contrasena: CONTRASENA_NUEVA }),
      ])
      expect([
        [200, 400],
        [400, 204],
      ]).toContainEqual([correccion.status, activacion.status])
    })

    it("el reenvio invalida el enlace anterior", async () => {
      const cliente = await crearCliente("Nuria", "reenvio")
      const primero = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")

      const respuesta = await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(respuesta.body.correoEnviado).toBe(true)
      const segundo = tokenDelCorreo(correo.ultimoPara(cliente.email)?.texto ?? "")
      expect(segundo).not.toBe(primero)

      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token: primero, contrasena: CONTRASENA_NUEVA })
        .expect(400)

      const todavia = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(todavia?.estado).toBe("pendiente")

      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token: segundo, contrasena: CONTRASENA_NUEVA })
        .expect(204)
    })

    it("nunca quedan dos enlaces vivos a la vez", async () => {
      const cliente = await crearCliente("Laia", "un-enlace")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(
        await prisma.tokenActivacion.count({
          where: { usuarioId: cliente.id, usadoEn: null },
        }),
      ).toBe(1)
    })

    it("no se reenvia a quien ya activo ni a quien esta de baja", async () => {
      const activo = await crearClienteActivo("Carlos", "reenvio-activo")
      const deBaja = await crearCliente("Oscar", "reenvio-baja")

      await request(app.getHttpServer())
        .post(`/usuarios/${deBaja.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const antes = await prisma.tokenActivacion.count()

      // Reenviar a un activo seria cambiarle la contrasena sin conocer la actual,
      // que es la tarea 20 con sus propias salvaguardas. A un desactivado seria
      // una via para volver a entrar despues de que le cortaran el acceso.
      await request(app.getHttpServer())
        .post(`/usuarios/${activo.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      await request(app.getHttpServer())
        .post(`/usuarios/${deBaja.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      expect(await prisma.tokenActivacion.count()).toBe(antes)
    })

    it("si el proveedor de correo falla, se dice la verdad y no se finge un error", async () => {
      const cliente = await crearCliente("Iris", "reenvio-sin-correo")
      correo.hacerFallarElProximoEnvio()

      const respuesta = await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // El enlace anterior ya esta quemado cuando falla el envio. Contestar con
      // un error diria que no ha pasado nada, cuando en realidad esa persona se
      // ha quedado sin ningun enlace valido.
      expect(respuesta.body.correoEnviado).toBe(false)
    })
  })

  describe("edicion de la ficha", () => {
    it("corrige nombre, apellidos, telefono y fecha", async () => {
      const cliente = await crearCliente("Jaun", "edicion")

      const respuesta = await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({ nombre: "Juan", apellidos: "Perez", telefono: "+34 600 00 00 00" })
        .expect(200)

      expect(respuesta.body.nombre).toBe("Juan")
      expect(respuesta.body.apellidos).toBe("Perez")
      expect(respuesta.body.telefono).toBe("+34 600 00 00 00")
    })

    it("distingue no mandar un campo de mandarlo vacio", async () => {
      const cliente = await crearCliente("Vera", "edicion-nulos")

      await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({ telefono: "600 99 88 77" })
        .expect(200)

      const sinTocar = await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({})
        .expect(200)

      expect(sinTocar.body.telefono).toBe("600 99 88 77")

      const vaciado = await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({ telefono: "" })
        .expect(200)

      expect(vaciado.body.telefono).toBeNull()
    })

    it("no deja cambiar el rol, el estado ni el correo", async () => {
      const cliente = await crearCliente("Tere", "edicion-prohibida")

      for (const cuerpo of [
        { rol: "entrenador" },
        { estado: "activo" },
        { email: `otro${SUFIJO}` },
        { passwordHash: "lo-que-sea" },
        { nombre: "Tere", rol: "entrenador" },
      ]) {
        await request(app.getHttpServer())
          .patch(`/usuarios/${cliente.id}`)
          .set("Authorization", como("entrenador"))
          .send(cuerpo)
          .expect(400)
      }

      const enBase = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(enBase?.rol).toBe("cliente")
      expect(enBase?.estado).toBe("pendiente")
      expect(enBase?.email).toBe(cliente.email)
    })

    it("rechaza valores con la forma equivocada", async () => {
      const cliente = await crearCliente("Aitor", "edicion-formato")

      for (const cuerpo of [
        { nombre: "" },
        { fechaNacimiento: "04/05/1990" },
        { telefono: "no es un telefono" },
      ]) {
        await request(app.getHttpServer())
          .patch(`/usuarios/${cliente.id}`)
          .set("Authorization", como("entrenador"))
          .send(cuerpo)
          .expect(400)
      }
    })

    it("se puede corregir la ficha de alguien que ya esta de baja", async () => {
      const cliente = await crearCliente("Bea", "edicion-baja")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Corregir un telefono en una ficha historica no le devuelve ningun acceso.
      const respuesta = await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}`)
        .set("Authorization", como("entrenador"))
        .send({ telefono: "600 00 11 22" })
        .expect(200)

      expect(respuesta.body.estado).toBe("desactivado")
    })
  })

  describe("correo mal tecleado", () => {
    it("se corrige mientras el perfil sigue pendiente, y el enlace nuevo va a la direccion nueva", async () => {
      const cliente = await crearCliente("Alba", "correo-malo")
      const bueno = `correo-bueno${SUFIJO}`

      const respuesta = await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: bueno })
        .expect(200)

      expect(respuesta.body.email).toBe(bueno)

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const token = tokenDelCorreo(correo.ultimoPara(bueno)?.texto ?? "")
      expect(token).not.toBe("")

      await request(app.getHttpServer())
        .post("/auth/activar")
        .send({ token, contrasena: CONTRASENA_NUEVA })
        .expect(204)

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: bueno, contrasena: CONTRASENA_NUEVA })
        .expect(200)
    })

    it("no se corrige el de quien ya entro ni el de quien esta de baja", async () => {
      const activo = await crearClienteActivo("Hugo", "correo-activo")
      const deBaja = await crearCliente("Gala", "correo-baja")

      await request(app.getHttpServer())
        .post(`/usuarios/${deBaja.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Cambiar el correo de quien ya entra es cambiarle la identidad, y sin
      // verificar la direccion nueva cualquiera se apropiaria de su cuenta.
      await request(app.getHttpServer())
        .patch(`/usuarios/${activo.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: `otro-mas${SUFIJO}` })
        .expect(400)

      await request(app.getHttpServer())
        .patch(`/usuarios/${deBaja.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: `otro-mas${SUFIJO}` })
        .expect(400)
    })

    it("no se puede pisar el correo de otra cuenta", async () => {
      const ocupante = await crearCliente("Noa", "correo-ocupado")
      const cliente = await crearCliente("Iker", "correo-libre")

      await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: ocupante.email })
        .expect(409)
    })

    it("rechaza lo que no es un correo", async () => {
      const cliente = await crearCliente("Unai", "correo-invalido")

      await request(app.getHttpServer())
        .patch(`/usuarios/${cliente.id}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: "no-es-un-correo" })
        .expect(400)
    })
  })

  describe("reactivar", () => {
    it("quien nunca activo vuelve a pendiente, no a activo", async () => {
      const cliente = await crearCliente("Olga", "reactiva-pendiente")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const respuesta = await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      // Ponerlo "activo" sin contrasena lo dejaria encerrado fuera: no podria
      // iniciar sesion nunca y tampoco recibir un enlace, que solo se manda a
      // quien esta pendiente.
      expect(respuesta.body.estado).toBe("pendiente")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(200)
    })

    it("quien tenia contrasena vuelve a activo y entra con la de siempre", async () => {
      const cliente = await crearClienteActivo("Lara", "reactiva-activo")

      await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const respuesta = await request(app.getHttpServer())
        .post(`/usuarios/${cliente.id}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(respuesta.body.estado).toBe("activo")

      await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: cliente.email, contrasena: CONTRASENA_NUEVA })
        .expect(200)
    })

    it("desactivar y reactivar dos veces no rompe nada", async () => {
      const cliente = await crearCliente("Toni", "idempotente")

      for (let vez = 0; vez < 2; vez += 1) {
        await request(app.getHttpServer())
          .post(`/usuarios/${cliente.id}/desactivar`)
          .set("Authorization", como("entrenador"))
          .expect(200)
      }

      for (let vez = 0; vez < 2; vez += 1) {
        await request(app.getHttpServer())
          .post(`/usuarios/${cliente.id}/reactivar`)
          .set("Authorization", como("entrenador"))
          .expect(200)
      }

      const enBase = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(enBase?.estado).toBe("pendiente")
    })
  })

  describe("el entrenador no se administra a si mismo", () => {
    it("no puede darse de baja, reactivarse, editarse ni cambiarse el correo", async () => {
      const propio = identificadores.get("entrenador") ?? ""

      await request(app.getHttpServer())
        .post(`/usuarios/${propio}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      await request(app.getHttpServer())
        .post(`/usuarios/${propio}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(400)

      await request(app.getHttpServer())
        .patch(`/usuarios/${propio}`)
        .set("Authorization", como("entrenador"))
        .send({ nombre: "Yo mismo" })
        .expect(400)

      await request(app.getHttpServer())
        .patch(`/usuarios/${propio}/correo`)
        .set("Authorization", como("entrenador"))
        .send({ email: `yo-mismo${SUFIJO}` })
        .expect(400)

      // Y sigue entrando: solo hay un entrenador, y quedarse sin el no tiene
      // arreglo desde la app.
      const enBase = await prisma.usuario.findUnique({ where: { id: propio } })
      expect(enBase?.estado).toBe("activo")
      expect(enBase?.nombre).toBe("entrenador")
    })
  })

  describe("permisos", () => {
    const rutas = (id: string): Array<{ metodo: "get" | "patch" | "post"; ruta: string }> => [
      { metodo: "get", ruta: `/usuarios/${id}` },
      { metodo: "patch", ruta: `/usuarios/${id}` },
      { metodo: "patch", ruta: `/usuarios/${id}/correo` },
      { metodo: "post", ruta: `/usuarios/${id}/reenviar-activacion` },
      { metodo: "post", ruta: `/usuarios/${id}/desactivar` },
      { metodo: "post", ruta: `/usuarios/${id}/reactivar` },
    ]

    it("los otros tres roles reciben denegacion en todas las rutas", async () => {
      const cliente = await crearCliente("Vigilado", "permisos")

      for (const rol of ROLES.filter((r) => r !== "entrenador")) {
        for (const { metodo, ruta } of rutas(cliente.id)) {
          const peticion = request(app.getHttpServer())
          await peticion[metodo](ruta).set("Authorization", como(rol)).send({}).expect(403)
        }
      }

      const enBase = await prisma.usuario.findUnique({ where: { id: cliente.id } })
      expect(enBase?.estado).toBe("pendiente")
      expect(enBase?.nombre).toBe("Vigilado")
    })

    it("sin sesion no se llega a ninguna", async () => {
      const cliente = await crearCliente("Anonimo", "permisos-sin-sesion")

      for (const { metodo, ruta } of rutas(cliente.id)) {
        await request(app.getHttpServer())[metodo](ruta).send({}).expect(401)
      }
    })

    it("un cliente no puede darse de alta a si mismo por la puerta de atras", async () => {
      await request(app.getHttpServer())
        .post("/usuarios")
        .set("Authorization", como("cliente"))
        .send({ email: `colado${SUFIJO}`, nombre: "Colado", rol: "cliente" })
        .expect(403)
    })
  })

  describe("peticiones mal dirigidas", () => {
    it("un identificador que no existe devuelve 404, no 500", async () => {
      await request(app.getHttpServer())
        .get(`/usuarios/${ID_INEXISTENTE}`)
        .set("Authorization", como("entrenador"))
        .expect(404)

      await request(app.getHttpServer())
        .patch(`/usuarios/${ID_INEXISTENTE}`)
        .set("Authorization", como("entrenador"))
        .send({ nombre: "Nadie" })
        .expect(404)

      await request(app.getHttpServer())
        .post(`/usuarios/${ID_INEXISTENTE}/desactivar`)
        .set("Authorization", como("entrenador"))
        .expect(404)

      await request(app.getHttpServer())
        .post(`/usuarios/${ID_INEXISTENTE}/reactivar`)
        .set("Authorization", como("entrenador"))
        .expect(404)

      await request(app.getHttpServer())
        .post(`/usuarios/${ID_INEXISTENTE}/reenviar-activacion`)
        .set("Authorization", como("entrenador"))
        .expect(404)
    })

    it("un identificador con otra forma devuelve 400", async () => {
      await request(app.getHttpServer())
        .get("/usuarios/no-es-un-identificador")
        .set("Authorization", como("entrenador"))
        .expect(400)

      await request(app.getHttpServer())
        .post("/usuarios/12345/desactivar")
        .set("Authorization", como("entrenador"))
        .expect(400)
    })
  })

  describe("lo que devuelve la ficha", () => {
    it("nunca lleva el hash de la contrasena, solo si la tiene", async () => {
      const pendiente = await crearCliente("Sin clave", "ficha-pendiente")
      const activo = await crearClienteActivo("Con clave", "ficha-activo")

      const sinClave = await request(app.getHttpServer())
        .get(`/usuarios/${pendiente.id}`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      const conClave = await request(app.getHttpServer())
        .get(`/usuarios/${activo.id}`)
        .set("Authorization", como("entrenador"))
        .expect(200)

      expect(sinClave.body.tieneContrasena).toBe(false)
      expect(conClave.body.tieneContrasena).toBe(true)
      expect(JSON.stringify(sinClave.body)).not.toContain("passwordHash")
      expect(JSON.stringify(conClave.body)).not.toContain("argon2")
    })
  })
})
