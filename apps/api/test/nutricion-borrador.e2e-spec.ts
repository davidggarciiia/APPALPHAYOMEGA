import request from "supertest"
import { BorradorDietaSchema, LecturaBorradorDietaSchema } from "@alpha-omega/shared"
import { documentoDeObjetivos, entornoNutricion } from "./nutricion-ayuda.js"

describe("Borrador de la dieta", () => {
  let entorno: Awaited<ReturnType<typeof entornoNutricion>>
  const ruta = (clienteId: string): string => `/nutricion/clientes/${clienteId}/borrador`

  beforeAll(async () => {
    entorno = await entornoNutricion("borrador")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("crea con la revisión 0, actualiza con la vigente y rechaza una obsoleta", async () => {
    const { app, como, ids } = entorno
    const vacio = await request(app.getHttpServer())
      .get(ruta(ids.cliente))
      .set(como("entrenador"))
      .expect(200)
    expect(LecturaBorradorDietaSchema.parse(vacio.body).borrador).toBeNull()

    const creado = BorradorDietaSchema.parse(
      (
        await request(app.getHttpServer())
          .put(ruta(ids.cliente))
          .set(como("entrenador"))
          .send({ revision: 0, documento: documentoDeObjetivos() })
          .expect(200)
      ).body,
    )
    expect(creado.revision).toBe(1)
    expect(creado.clienteId).toBe(ids.cliente)

    const actualizado = BorradorDietaSchema.parse(
      (
        await request(app.getHttpServer())
          .put(ruta(ids.cliente))
          .set(como("entrenador"))
          .send({ revision: 1, documento: documentoDeObjetivos("Segunda versión") })
          .expect(200)
      ).body,
    )
    expect(actualizado.revision).toBe(2)
    expect(actualizado.documento.nombre).toBe("Segunda versión")

    for (const revision of [1, 0]) {
      const obsoleta = await request(app.getHttpServer())
        .put(ruta(ids.cliente))
        .set(como("entrenador"))
        .send({ revision, documento: documentoDeObjetivos("Pisaría la anterior") })
        .expect(409)
      expect(obsoleta.body.codigo).toBe("revision_obsoleta")
    }

    const leido = await request(app.getHttpServer())
      .get(ruta(ids.cliente))
      .set(como("entrenador"))
      .expect(200)
    expect(LecturaBorradorDietaSchema.parse(leido.body).borrador?.documento.nombre).toBe(
      "Segunda versión",
    )
  })

  it("rechaza un documento inválido con solicitud_invalida y no guarda nada", async () => {
    const { app, como, ids } = entorno
    const documento = { ...documentoDeObjetivos(), semana: [] }
    const respuesta = await request(app.getHttpServer())
      .put(ruta(ids.pendiente))
      .set(como("entrenador"))
      .send({ revision: 0, documento })
      .expect(400)
    expect(respuesta.body.codigo).toBe("solicitud_invalida")
    expect(await entorno.prisma.dieta.count({ where: { clienteId: ids.pendiente } })).toBe(0)
  })

  it("deja preparar la dieta de un cliente pendiente", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer())
      .put(ruta(ids.pendiente))
      .set(como("entrenador"))
      .send({ revision: 0, documento: documentoDeObjetivos() })
      .expect(200)
  })

  it("rechaza escribir la dieta de un cliente dado de baja", async () => {
    const { app, como, ids } = entorno
    const respuesta = await request(app.getHttpServer())
      .put(ruta(ids.desactivado))
      .set(como("entrenador"))
      .send({ revision: 0, documento: documentoDeObjetivos() })
      .expect(409)
    expect(respuesta.body.codigo).toBe("operacion_incompatible")
  })

  it("responde 404 si la persona indicada no es un cliente", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer())
      .put(ruta(ids.nutricionista))
      .set(como("entrenador"))
      .send({ revision: 0, documento: documentoDeObjetivos() })
      .expect(404)
  })

  it("el nutricionista asignado lo edita y pierde el acceso al retirarle la asignación", async () => {
    const { app, como, ids, prisma } = entorno
    const actual = LecturaBorradorDietaSchema.parse(
      (
        await request(app.getHttpServer())
          .get(ruta(ids.cliente))
          .set(como("nutricionista"))
          .expect(200)
      ).body,
    ).borrador
    await request(app.getHttpServer())
      .put(ruta(ids.cliente))
      .set(como("nutricionista"))
      .send({
        revision: actual?.revision ?? 0,
        documento: documentoDeObjetivos("Del nutricionista"),
      })
      .expect(200)

    await prisma.asignacionNutricionista.deleteMany({
      where: { nutricionistaId: ids.nutricionista, clienteId: ids.cliente },
    })
    await request(app.getHttpServer()).get(ruta(ids.cliente)).set(como("nutricionista")).expect(403)
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista, clienteId: ids.cliente },
    })
  })

  it("deniega el borrador a quien no puede prepararlo", async () => {
    const { app, como, ids } = entorno
    const casos = [
      { cuenta: "cliente", estado: 403 },
      { cuenta: "otro", estado: 403 },
      { cuenta: "nutriAjeno", estado: 403 },
      { cuenta: "empleado", estado: 403 },
      { cuenta: "anonimo", estado: 401 },
    ] as const
    for (const { cuenta, estado } of casos) {
      await request(app.getHttpServer()).get(ruta(ids.cliente)).set(como(cuenta)).expect(estado)
      await request(app.getHttpServer())
        .put(ruta(ids.cliente))
        .set(como(cuenta))
        .send({ revision: 0, documento: documentoDeObjetivos() })
        .expect(estado)
    }
    // El nutricionista tampoco llega a un cliente dado de baja aunque la fila siga.
    await request(app.getHttpServer())
      .get(ruta(ids.desactivado))
      .set(como("nutricionista"))
      .expect(403)
  })
})
