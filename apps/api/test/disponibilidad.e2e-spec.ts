import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  ErrorDeApiSchema,
  HuecoDisponibilidadSchema,
  ListadoHuecosSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Disponibilidad del entrenador", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let segundo: { Authorization: string }
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("disponibilidad", async (prisma, ids) => {
      await prisma.huecoDisponibilidad.deleteMany({ where: { entrenadorId: { in: ids } } })
      await prisma.aperturaDisponibilidad.deleteMany({ where: { entrenadorId: { in: ids } } })
    })
    const original = await entorno.prisma.usuario.findUniqueOrThrow({
      where: { id: entorno.ids.entrenador },
    })
    const usuario = await entorno.prisma.usuario.create({
      data: {
        nombre: "Segundo entrenador",
        email: "segundo@e2e-entrenamiento-disponibilidad.test",
        passwordHash: original.passwordHash,
        rol: "entrenador",
        estado: "activo",
      },
    })
    entorno.ids.segundo = usuario.id
    const login = await request(entorno.app.getHttpServer())
      .post("/auth/login")
      .send({ email: usuario.email, contrasena: "Prueba-entrenamiento-2026!" })
      .expect(200)
    segundo = { Authorization: `Bearer ${login.body.tokenAcceso}` }
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  function datos(fecha = "2027-02-01", horaInicio = "10:00") {
    return {
      operacionId: randomUUID(),
      fecha,
      horaInicio,
      servicios: ["entrenoPersonal", "seguimiento"],
    }
  }
  function abrir(body: object = datos(), actor?: { Authorization: string }) {
    return request(entorno.app.getHttpServer())
      .post("/disponibilidad/huecos")
      .set(actor ?? entorno.como("entrenador"))
      .send(body)
  }
  async function listar(desde: string, hasta = desde, actor?: { Authorization: string }) {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(`/disponibilidad/huecos?desde=${desde}&hasta=${hasta}`)
      .set(actor ?? entorno.como("entrenador"))
      .expect(200)
    return ListadoHuecosSchema.parse(respuesta.body)
  }
  function cerrar(id: string, actor?: { Authorization: string }) {
    return request(entorno.app.getHttpServer())
      .patch(`/disponibilidad/huecos/${id}/cerrar`)
      .set(actor ?? entorno.como("entrenador"))
      .send({})
  }

  it("abre con duración 60 por defecto y conserva hora local, servicios e instantes UTC", async () => {
    const respuesta = await abrir().expect(201)
    const listado = ListadoHuecosSchema.parse(respuesta.body)
    expect(listado.total).toBe(1)
    expect(listado.huecos).toHaveLength(1)
    expect(listado.huecos[0]).toMatchObject({
      entrenadorId: entorno.ids.entrenador,
      fecha: "2027-02-01",
      horaInicio: "10:00",
      inicioEn: "2027-02-01T09:00:00.000Z",
      finEn: "2027-02-01T10:00:00.000Z",
      duracionMinutos: 60,
      servicios: ["entrenoPersonal", "seguimiento"],
      estado: "libre",
      cerradoEn: null,
    })
    expect((await listar("2027-02-01")).huecos).toEqual(listado.huecos)
  })

  it("repite cada siete días manteniendo la hora Madrid al cambiar el horario", async () => {
    const respuesta = await abrir({ ...datos("2027-03-21", "10:30"), semanas: 3 } as ReturnType<
      typeof datos
    >).expect(201)
    const listado = ListadoHuecosSchema.parse(respuesta.body)
    expect(listado.huecos.map((h) => [h.fecha, h.horaInicio, h.inicioEn])).toEqual([
      ["2027-03-21", "10:30", "2027-03-21T09:30:00.000Z"],
      ["2027-03-28", "10:30", "2027-03-28T08:30:00.000Z"],
      ["2027-04-04", "10:30", "2027-04-04T08:30:00.000Z"],
    ])
  })

  it("la apertura repetida es atómica ante una hora inexistente o ambigua", async () => {
    await abrir({ ...datos("2027-03-21", "02:30"), semanas: 2 } as ReturnType<typeof datos>).expect(
      400,
    )
    expect((await listar("2027-03-21")).huecos).toHaveLength(1)
    await abrir(datos("2027-10-31", "02:30")).expect(400)
    expect((await listar("2027-10-31")).total).toBe(0)
  })

  it("reintentos simultáneos de una operación crean una sola apertura; otros datos con la misma clave fallan", async () => {
    const body = datos("2027-02-02")
    const respuestas = await Promise.all([abrir(body), abrir(body)])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect((await listar("2027-02-02")).total).toBe(1)
    await abrir({ ...body, horaInicio: "11:00" }).expect(409)
    await abrir({ ...body, servicios: [...body.servicios].reverse() }).expect(201)
    await abrir(body, segundo).expect(201)
  })

  it("dos aperturas concurrentes que se solapan no crean dos huecos", async () => {
    const respuestas = await Promise.all([
      abrir(datos("2027-02-03", "10:00")),
      abrir(datos("2027-02-03", "10:30")),
    ])
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409])
    expect((await listar("2027-02-03")).total).toBe(1)
  })

  it("un solape de una repetición rechaza toda la apertura y permite huecos contiguos", async () => {
    await abrir(datos("2027-02-11", "10:00")).expect(201)
    await abrir({ ...datos("2027-02-04", "10:30"), semanas: 2 } as ReturnType<typeof datos>).expect(
      409,
    )
    expect((await listar("2027-02-04")).total).toBe(0)
    await abrir(datos("2027-02-11", "11:00")).expect(201)
  })

  it("cierra huecos libres de forma idempotente y permite volver a abrir ese horario", async () => {
    const original = ListadoHuecosSchema.parse((await abrir(datos("2027-02-05")).expect(201)).body)
      .huecos[0]!
    const cerrado = HuecoDisponibilidadSchema.parse((await cerrar(original.id).expect(200)).body)
    expect(cerrado.estado).toBe("cerrado")
    expect(cerrado.cerradoEn).not.toBeNull()
    expect((await cerrar(original.id).expect(200)).body).toEqual(cerrado)
    await abrir(datos("2027-02-05")).expect(201)
    expect((await listar("2027-02-05")).total).toBe(2)
  })

  it("no cierra un hueco reservado ni cambia su estado", async () => {
    const hueco = ListadoHuecosSchema.parse((await abrir(datos("2027-02-06")).expect(201)).body)
      .huecos[0]!
    await entorno.prisma
      .$executeRaw`UPDATE "huecos_disponibilidad" SET "estado" = 'reservado' WHERE "id" = ${hueco.id}`
    const respuesta = await cerrar(hueco.id).expect(409)
    expect(ErrorDeApiSchema.safeParse(respuesta.body).success).toBe(true)
    expect(respuesta.body.codigo).toBe("estado_incompatible")
    expect(respuesta.body.message).toMatch(/reservado/i)
    expect((await listar("2027-02-06")).huecos[0]!.estado).toBe("reservado")
  })

  it("el listado es propio y paginado; un entrenador no cierra un hueco de otro", async () => {
    const propio = ListadoHuecosSchema.parse((await abrir(datos("2027-02-07")).expect(201)).body)
      .huecos[0]!
    await abrir(datos("2027-02-07"), segundo).expect(201)
    expect((await listar("2027-02-07")).huecos.map((h) => h.entrenadorId)).toEqual([
      entorno.ids.entrenador,
    ])
    expect(
      (await listar("2027-02-07", "2027-02-07", segundo)).huecos.map((h) => h.entrenadorId),
    ).toEqual([entorno.ids.segundo])
    await cerrar(propio.id, segundo).expect(404)
    await cerrar(randomUUID()).expect(404)
    const pagina = await request(entorno.app.getHttpServer())
      .get("/disponibilidad/huecos?desde=2027-02-01&hasta=2027-02-28&limite=1&desplazamiento=1")
      .set(entorno.como("entrenador"))
      .expect(200)
    const listado = ListadoHuecosSchema.parse(pagina.body)
    expect(listado.huecos).toHaveLength(1)
    expect(listado.total).toBeGreaterThan(1)
  })

  it("rechaza acceso sin sesión y de perfiles que no son entrenador", async () => {
    await request(entorno.app.getHttpServer())
      .get("/disponibilidad/huecos?desde=2027-01-01&hasta=2027-01-01")
      .expect(401)
    for (const rol of ["cliente", "otro", "nutricionista", "empleado"]) {
      const actor = entorno.como(rol)
      await abrir(datos("2027-02-08"), actor).expect(403)
      await request(entorno.app.getHttpServer())
        .get("/disponibilidad/huecos?desde=2027-01-01&hasta=2027-01-01")
        .set(actor)
        .expect(403)
      await cerrar(randomUUID(), actor).expect(403)
    }
  })

  it("valida entrada sin aceptar autor, estado, servicios futuros ni consultas sin límites", async () => {
    for (const cambio of [
      { entrenadorId: randomUUID() },
      { estado: "reservado" },
      { servicios: ["quiromasaje"] },
      { servicios: [] },
      { semanas: 53 },
      { duracionMinutos: 0 },
      { horaInicio: "24:00" },
      { fecha: "2027-02-30" },
    ])
      await abrir({ ...datos("2027-02-09"), ...cambio } as ReturnType<typeof datos>).expect(400)
    for (const consulta of [
      "",
      "?desde=2027-02-01&hasta=2027-01-01",
      "?desde=2027-01-01&hasta=2028-01-03",
      "?desde=2027-01-01&hasta=2027-01-01&limite=101",
    ])
      await request(entorno.app.getHttpServer())
        .get(`/disponibilidad/huecos${consulta}`)
        .set(entorno.como("entrenador"))
        .expect(400)
    await cerrar("no-uuid").expect(400)
    expect((await listar("2027-02-09")).total).toBe(0)
  })

  it("rechaza antes de escribir si el fin excede las fechas del contrato", async () => {
    await abrir({ ...datos("9999-12-31", "23:00"), duracionMinutos: 480 }).expect(400)
    expect((await listar("9999-12-31")).total).toBe(0)
  })
})
