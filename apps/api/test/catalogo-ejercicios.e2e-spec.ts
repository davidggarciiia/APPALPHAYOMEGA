import type { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import {
  EjercicioSchema,
  ErrorDeApiSchema,
  ListadoEjerciciosSchema,
  ROLES,
  type CrearEjercicio,
  type Ejercicio,
  type Rol,
} from "@alpha-omega/shared"
import request from "supertest"

import { AppModule } from "../src/app.module.js"
import { cifrarContrasena } from "../src/identity/contrasenas.js"
import { PrismaService } from "../src/prisma/prisma.service.js"

const SUFIJO = "@e2e-catalogo.test"
const CONTRASENA = "contrasena-de-prueba-catalogo"

/**
 * Todo ejercicio de esta suite empieza asi. La limpieza borra por este prefijo y
 * las busquedas lo incluyen, para no depender de lo que ya hubiera en la base.
 */
const PREFIJO = "e2e-catalogo"
const ID_QUE_NO_EXISTE = "3f2b8c1e-4d5a-4f6b-8a9c-0d1e2f3a4bff"

function ficha(nombre: string, cambios: Partial<CrearEjercicio> = {}): CrearEjercicio {
  return {
    nombre: `${PREFIJO} ${nombre}`,
    grupoPrincipal: "pecho",
    gruposSecundarios: [],
    instrucciones: "Baja controlando y sube sin bloquear.",
    ...cambios,
  }
}

describe("Catalogo de ejercicios", () => {
  let app: INestApplication
  let prisma: PrismaService
  const tokens = new Map<Rol, string>()

  function como(rol: Rol): { Authorization: string } {
    return { Authorization: `Bearer ${tokens.get(rol) ?? ""}` }
  }

  async function crear(datos: CrearEjercicio): Promise<Ejercicio> {
    const respuesta = await request(app.getHttpServer())
      .post("/ejercicios")
      .set(como("entrenador"))
      .send(datos)
      .expect(201)

    return EjercicioSchema.parse(respuesta.body)
  }

  // La API no borra ejercicios. La suite si, por debajo, para poder repetirse.
  async function limpiar(): Promise<void> {
    await prisma.ejercicio.deleteMany({ where: { nombreNormalizado: { startsWith: PREFIJO } } })
  }

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile()

    app = modulo.createNestApplication()
    await app.init()

    prisma = app.get(PrismaService)
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await limpiar()

    const passwordHash = await cifrarContrasena(CONTRASENA)
    for (const rol of ROLES) {
      const email = `${rol}${SUFIJO}`
      await prisma.usuario.create({
        data: { email, nombre: rol, passwordHash, rol, estado: "activo" },
      })

      const login = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email, contrasena: CONTRASENA })
        .expect(200)

      tokens.set(rol, login.body.tokenAcceso)
    }
  })

  afterEach(limpiar)

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { endsWith: SUFIJO } } })
    await app.close()
  })

  it("devuelve el contrato común de validación en lugar de un cuerpo de identidad", async () => {
    const respuesta = await request(app.getHttpServer())
      .post("/ejercicios")
      .set(como("entrenador"))
      .send({ nombre: "" })
      .expect(400)
    expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("solicitud_invalida")
  })

  it("guarda nombres válidos cuya normalización Unicode ocupa más caracteres", async () => {
    const nombre = `${PREFIJO}${"İ".repeat(120 - PREFIJO.length)}`
    const respuesta = await request(app.getHttpServer())
      .post("/ejercicios")
      .set(como("entrenador"))
      .send({ ...ficha("unicode"), nombre })
      .expect(201)
    expect(EjercicioSchema.parse(respuesta.body).nombre).toBe(nombre)
  })

  describe("quien puede que", () => {
    it("sin sesion no se obtiene ni se escribe nada", async () => {
      const servidor = app.getHttpServer()

      await request(servidor).get("/ejercicios").expect(401)
      await request(servidor).get(`/ejercicios/${ID_QUE_NO_EXISTE}`).expect(401)
      await request(servidor).post("/ejercicios").send(ficha("sin sesion")).expect(401)
      await request(servidor)
        .patch(`/ejercicios/${ID_QUE_NO_EXISTE}`)
        .send(ficha("sin sesion"))
        .expect(401)
    })

    for (const rol of ["nutricionista", "empleado"] as const) {
      it(`DENIEGA a ${rol} en todas las rutas, tambien en la lectura`, async () => {
        const existente = await crear(ficha(`visto por ${rol}`))
        const servidor = app.getHttpServer()

        await request(servidor).get("/ejercicios").set(como(rol)).expect(403)
        await request(servidor).get(`/ejercicios/${existente.id}`).set(como(rol)).expect(403)
        await request(servidor).post("/ejercicios").set(como(rol)).send(ficha("ajeno")).expect(403)
        await request(servidor)
          .patch(`/ejercicios/${existente.id}`)
          .set(como(rol))
          .send(ficha("ajeno"))
          .expect(403)
      })
    }

    it("el cliente lee la ficha y el listado", async () => {
      const existente = await crear(ficha("para el cliente"))

      const detalle = await request(app.getHttpServer())
        .get(`/ejercicios/${existente.id}`)
        .set(como("cliente"))
        .expect(200)
      expect(EjercicioSchema.parse(detalle.body)).toEqual(existente)

      const listado = await request(app.getHttpServer())
        .get("/ejercicios")
        .query({ buscar: PREFIJO })
        .set(como("cliente"))
        .expect(200)
      expect(ListadoEjerciciosSchema.parse(listado.body).total).toBe(1)
    })

    it("DENIEGA al cliente crear y editar, y no cambia nada", async () => {
      const existente = await crear(ficha("intocable"))

      await request(app.getHttpServer())
        .post("/ejercicios")
        .set(como("cliente"))
        .send(ficha("del cliente"))
        .expect(403)
      await request(app.getHttpServer())
        .patch(`/ejercicios/${existente.id}`)
        .set(como("cliente"))
        .send(ficha("cambiado por el cliente"))
        .expect(403)

      const filas = await prisma.ejercicio.findMany({
        where: { nombreNormalizado: { startsWith: PREFIJO } },
      })
      expect(filas.map((fila) => fila.nombre)).toEqual([existente.nombre])
    })

    it("DENIEGA al cliente pedir ejercicios que no esten publicados", async () => {
      for (const estado of ["retirado", "todos"]) {
        await request(app.getHttpServer())
          .get("/ejercicios")
          .query({ estado })
          .set(como("cliente"))
          .expect(403)
      }
    })

    it("no existe ninguna ruta que borre un ejercicio", async () => {
      const existente = await crear(ficha("imborrable"))

      await request(app.getHttpServer())
        .delete(`/ejercicios/${existente.id}`)
        .set(como("entrenador"))
        .expect(404)

      expect(await prisma.ejercicio.count({ where: { id: existente.id } })).toBe(1)
    })
  })

  describe("alta y ficha", () => {
    it("crea un ejercicio de texto, sin figura ni video, y lo devuelve por su id", async () => {
      const creado = await crear(
        ficha("  Press de banca  ", { gruposSecundarios: ["triceps", "hombros"] }),
      )

      expect(creado).toMatchObject({
        nombre: `${PREFIJO}   Press de banca`,
        grupoPrincipal: "pecho",
        estado: "publicado",
        figura: null,
        video: null,
      })
      expect([...creado.gruposSecundarios].sort()).toEqual(["hombros", "triceps"])

      const detalle = await request(app.getHttpServer())
        .get(`/ejercicios/${creado.id}`)
        .set(como("entrenador"))
        .expect(200)
      expect(EjercicioSchema.parse(detalle.body)).toEqual(creado)
    })

    it("rechaza con 409 un nombre que solo cambia en mayusculas y espacios", async () => {
      await crear(ficha("Remo con barra"))

      const respuesta = await request(app.getHttpServer())
        .post("/ejercicios")
        .set(como("entrenador"))
        .send({ ...ficha("x"), nombre: `  ${PREFIJO.toUpperCase()}   remo   CON barra ` })
        .expect(409)

      // El formulario pinta este rechazo en el campo del nombre por su codigo.
      expect(ErrorDeApiSchema.parse(respuesta.body)).toMatchObject({ codigo: "nombre_duplicado" })

      expect(
        await prisma.ejercicio.count({ where: { nombreNormalizado: { startsWith: PREFIJO } } }),
      ).toBe(1)
    })

    it.each([
      ["un grupo fuera del vocabulario", { grupoPrincipal: "dorsales" }],
      ["el principal repetido como secundario", { gruposSecundarios: ["pecho"] }],
      ["un secundario repetido", { gruposSecundarios: ["triceps", "triceps"] }],
      ["un nombre vacio", { nombre: "   " }],
      ["unas instrucciones vacias", { instrucciones: "" }],
      ["un campo que el formulario no edita", { estado: "retirado" }],
    ])("rechaza con 400 %s y no crea nada", async (_caso, cambios) => {
      await request(app.getHttpServer())
        .post("/ejercicios")
        .set(como("entrenador"))
        .send({ ...ficha("invalido"), ...cambios })
        .expect(400)

      expect(
        await prisma.ejercicio.count({ where: { nombreNormalizado: { startsWith: PREFIJO } } }),
      ).toBe(0)
    })

    it("un id que no existe es 404 y uno mal formado es 400", async () => {
      await request(app.getHttpServer())
        .get(`/ejercicios/${ID_QUE_NO_EXISTE}`)
        .set(como("entrenador"))
        .expect(404)
      await request(app.getHttpServer())
        .get("/ejercicios/no-es-un-uuid")
        .set(como("entrenador"))
        .expect(400)
    })
  })

  describe("edicion", () => {
    it("sustituye la ficha de texto y conserva el id", async () => {
      const creado = await crear(ficha("Fondos", { gruposSecundarios: ["triceps"] }))

      const respuesta = await request(app.getHttpServer())
        .patch(`/ejercicios/${creado.id}`)
        .set(como("entrenador"))
        .send(
          ficha("Fondos en paralelas", {
            grupoPrincipal: "triceps",
            gruposSecundarios: ["pecho"],
            instrucciones: "Baja hasta noventa grados.",
          }),
        )
        .expect(200)

      expect(EjercicioSchema.parse(respuesta.body)).toEqual({
        ...creado,
        nombre: `${PREFIJO} Fondos en paralelas`,
        grupoPrincipal: "triceps",
        gruposSecundarios: ["pecho"],
        instrucciones: "Baja hasta noventa grados.",
      })
    })

    it("guardar sin cambiar el nombre no choca consigo mismo", async () => {
      const creado = await crear(ficha("Dominadas", { grupoPrincipal: "espalda" }))

      await request(app.getHttpServer())
        .patch(`/ejercicios/${creado.id}`)
        .set(como("entrenador"))
        .send(ficha("Dominadas", { grupoPrincipal: "espalda", instrucciones: "Sin balanceo." }))
        .expect(200)
    })

    it("rechaza con 409 tomar el nombre de otro y deja los dos como estaban", async () => {
      const press = await crear(ficha("Press militar", { grupoPrincipal: "hombros" }))
      const elevaciones = await crear(ficha("Elevaciones", { grupoPrincipal: "hombros" }))

      const respuesta = await request(app.getHttpServer())
        .patch(`/ejercicios/${elevaciones.id}`)
        .set(como("entrenador"))
        .send(ficha("PRESS  militar", { grupoPrincipal: "hombros" }))
        .expect(409)
      expect(ErrorDeApiSchema.parse(respuesta.body)).toMatchObject({ codigo: "nombre_duplicado" })

      const filas = await prisma.ejercicio.findMany({
        where: { id: { in: [press.id, elevaciones.id] } },
        orderBy: { nombre: "asc" },
      })
      expect(filas.map((fila) => fila.nombre)).toEqual([elevaciones.nombre, press.nombre])
    })

    it("el nombre que se deja libre se puede volver a usar", async () => {
      const creado = await crear(ficha("Curl"))

      await request(app.getHttpServer())
        .patch(`/ejercicios/${creado.id}`)
        .set(como("entrenador"))
        .send(ficha("Curl con barra"))
        .expect(200)

      await crear(ficha("Curl"))
    })

    it("editar un id que no existe es 404", async () => {
      await request(app.getHttpServer())
        .patch(`/ejercicios/${ID_QUE_NO_EXISTE}`)
        .set(como("entrenador"))
        .send(ficha("fantasma"))
        .expect(404)
    })
  })

  describe("busqueda", () => {
    async function buscar(consulta: Record<string, string | number>): Promise<{
      nombres: string[]
      total: number
    }> {
      const respuesta = await request(app.getHttpServer())
        .get("/ejercicios")
        .query({ buscar: PREFIJO, ...consulta })
        .set(como("entrenador"))
        .expect(200)
      const listado = ListadoEjerciciosSchema.parse(respuesta.body)

      return {
        nombres: listado.ejercicios.map((fila) => fila.nombre.slice(PREFIJO.length + 1)),
        total: listado.total,
      }
    }

    it("encuentra por un trozo del nombre sin distinguir mayusculas", async () => {
      await crear(ficha("Sentadilla bulgara", { grupoPrincipal: "cuadriceps" }))
      await crear(ficha("Press de banca"))

      expect(await buscar({ buscar: `${PREFIJO} SENTA` })).toEqual({
        nombres: ["Sentadilla bulgara"],
        total: 1,
      })
    })

    it("filtra por grupo, sea principal o secundario, y ordena por nombre", async () => {
      await crear(ficha("Press de banca", { gruposSecundarios: ["triceps"] }))
      await crear(ficha("Fondos", { grupoPrincipal: "triceps", gruposSecundarios: ["pecho"] }))
      await crear(ficha("Sentadilla", { grupoPrincipal: "cuadriceps" }))

      expect(await buscar({ grupo: "pecho" })).toEqual({
        nombres: ["Fondos", "Press de banca"],
        total: 2,
      })
    })

    it("devuelve el total real aunque el limite corte la pagina", async () => {
      for (const nombre of ["A", "B", "C"]) {
        await crear(ficha(nombre))
      }

      expect(await buscar({ limite: 2 })).toEqual({ nombres: ["A", "B"], total: 3 })
      expect(await buscar({ limite: 2, desplazamiento: 2 })).toEqual({ nombres: ["C"], total: 3 })
    })

    it.each([
      ["un grupo fuera del vocabulario", { grupo: "dorsales" }],
      ["un limite por encima del maximo", { limite: 101 }],
      ["un parametro desconocido", { orden: "reciente" }],
    ])("rechaza con 400 %s", async (_caso, consulta) => {
      await request(app.getHttpServer())
        .get("/ejercicios")
        .query(consulta)
        .set(como("entrenador"))
        .expect(400)
    })
  })

  describe("retirar y reponer", () => {
    async function cambiar(
      operacion: "retirar" | "reponer",
      id: string,
      rol: Rol = "entrenador",
    ): Promise<request.Response> {
      return request(app.getHttpServer()).post(`/ejercicios/${id}/${operacion}`).set(como(rol))
    }

    async function nombresVisibles(rol: Rol, estado?: string): Promise<string[]> {
      const respuesta = await request(app.getHttpServer())
        .get("/ejercicios")
        .query({ buscar: PREFIJO, ...(estado !== undefined && { estado }) })
        .set(como(rol))
        .expect(200)

      return ListadoEjerciciosSchema.parse(respuesta.body).ejercicios.map((fila) => fila.nombre)
    }

    it("retirar lo saca de la busqueda de todos, pero no de la base", async () => {
      const vigente = await crear(ficha("Vigente"))
      const viejo = await crear(ficha("Viejo"))

      const respuesta = await cambiar("retirar", viejo.id)

      expect(respuesta.status).toBe(200)
      expect(EjercicioSchema.parse(respuesta.body)).toEqual({ ...viejo, estado: "retirado" })
      expect(await nombresVisibles("entrenador")).toEqual([vigente.nombre])
      expect(await nombresVisibles("cliente")).toEqual([vigente.nombre])
      expect(await prisma.ejercicio.count({ where: { id: viejo.id } })).toBe(1)
    })

    it("el entrenador puede pedir los retirados, solos o junto al resto", async () => {
      const vigente = await crear(ficha("Vigente"))
      const viejo = await crear(ficha("Viejo"))
      await cambiar("retirar", viejo.id)

      expect(await nombresVisibles("entrenador", "retirado")).toEqual([viejo.nombre])
      expect(await nombresVisibles("entrenador", "todos")).toEqual([viejo.nombre, vigente.nombre])
    })

    it("un retirado se sigue abriendo por su id, tambien para el cliente, y lo dice", async () => {
      const viejo = await crear(ficha("Viejo"))
      await cambiar("retirar", viejo.id)

      for (const rol of ["cliente", "entrenador"] as const) {
        const detalle = await request(app.getHttpServer())
          .get(`/ejercicios/${viejo.id}`)
          .set(como(rol))
          .expect(200)
        expect(EjercicioSchema.parse(detalle.body).estado).toBe("retirado")
      }
    })

    it("reponer lo devuelve a la busqueda y olvida cuando se retiro", async () => {
      const viejo = await crear(ficha("Viejo"))
      await cambiar("retirar", viejo.id)

      const respuesta = await cambiar("reponer", viejo.id)

      expect(respuesta.status).toBe(200)
      expect(EjercicioSchema.parse(respuesta.body)).toEqual(viejo)
      expect(await nombresVisibles("cliente")).toEqual([viejo.nombre])
      const fila = await prisma.ejercicio.findUniqueOrThrow({ where: { id: viejo.id } })
      expect(fila.retiradoEn).toBeNull()
    })

    it("repetir la operacion no es un error ni mueve la fecha de retirada", async () => {
      const viejo = await crear(ficha("Viejo"))

      expect((await cambiar("reponer", viejo.id)).status).toBe(200)
      expect((await cambiar("retirar", viejo.id)).status).toBe(200)
      const primera = await prisma.ejercicio.findUniqueOrThrow({ where: { id: viejo.id } })
      expect(primera.retiradoEn).not.toBeNull()

      const repetida = await cambiar("retirar", viejo.id)

      expect(repetida.status).toBe(200)
      expect(EjercicioSchema.parse(repetida.body).estado).toBe("retirado")
      const segunda = await prisma.ejercicio.findUniqueOrThrow({ where: { id: viejo.id } })
      expect(segunda.retiradoEn).toEqual(primera.retiradoEn)
    })

    it("editar la ficha de un retirado no lo repone", async () => {
      const viejo = await crear(ficha("Viejo"))
      await cambiar("retirar", viejo.id)

      const respuesta = await request(app.getHttpServer())
        .patch(`/ejercicios/${viejo.id}`)
        .set(como("entrenador"))
        .send(ficha("Viejo", { instrucciones: "Texto corregido." }))
        .expect(200)

      expect(EjercicioSchema.parse(respuesta.body).estado).toBe("retirado")
    })

    it("DENIEGA retirar y reponer a quien no es el entrenador, y no cambia nada", async () => {
      const vigente = await crear(ficha("Vigente"))
      const viejo = await crear(ficha("Viejo"))
      await cambiar("retirar", viejo.id)

      for (const rol of ["cliente", "nutricionista", "empleado"] as const) {
        expect((await cambiar("retirar", vigente.id, rol)).status).toBe(403)
        expect((await cambiar("reponer", viejo.id, rol)).status).toBe(403)
      }
      await request(app.getHttpServer()).post(`/ejercicios/${vigente.id}/retirar`).expect(401)
      await request(app.getHttpServer()).post(`/ejercicios/${viejo.id}/reponer`).expect(401)

      expect(await nombresVisibles("entrenador")).toEqual([vigente.nombre])
      expect(await nombresVisibles("entrenador", "retirado")).toEqual([viejo.nombre])
    })

    it("un id que no existe es 404 y uno mal formado es 400", async () => {
      for (const operacion of ["retirar", "reponer"] as const) {
        expect((await cambiar(operacion, ID_QUE_NO_EXISTE)).status).toBe(404)
        expect((await cambiar(operacion, "no-es-un-uuid")).status).toBe(400)
      }
    })
  })
})
