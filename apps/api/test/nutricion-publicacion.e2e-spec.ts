import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  BorradorDietaSchema,
  DietaPublicadaSchema,
  LecturaBorradorDietaSchema,
  LecturaDietaVigenteSchema,
} from "@alpha-omega/shared"
import { documentoDeObjetivos, entornoNutricion } from "./nutricion-ayuda.js"

describe("Publicación de la dieta", () => {
  let entorno: Awaited<ReturnType<typeof entornoNutricion>>
  const base = (clienteId: string): string => `/nutricion/clientes/${clienteId}`

  beforeAll(async () => {
    entorno = await entornoNutricion("publicacion")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function guardar(clienteId: string, revision: number, nombre: string): Promise<number> {
    const respuesta = await request(entorno.app.getHttpServer())
      .put(`${base(clienteId)}/borrador`)
      .set(entorno.como("entrenador"))
      .send({ revision, documento: documentoDeObjetivos(nombre) })
      .expect(200)
    return BorradorDietaSchema.parse(respuesta.body).revision
  }

  async function vigente(cuenta: "cliente" | "entrenador"): Promise<string | null> {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(`${base(entorno.ids.cliente)}/dieta`)
      .set(entorno.como(cuenta))
      .expect(200)
    return LecturaDietaVigenteSchema.parse(respuesta.body).dieta?.documento.nombre ?? null
  }

  it("el cliente no ve el borrador y sí la dieta al publicarla", async () => {
    const { app, como, ids } = entorno
    const revision = await guardar(ids.cliente, 0, "Primera dieta")
    expect(await vigente("cliente")).toBeNull()

    const operacionId = randomUUID()
    const publicada = DietaPublicadaSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${base(ids.cliente)}/borrador/publicar`)
          .set(como("entrenador"))
          .send({ operacionId, revision })
          .expect(200)
      ).body,
    )
    expect(publicada.documento.nombre).toBe("Primera dieta")
    expect(await vigente("cliente")).toBe("Primera dieta")
    expect(publicada).not.toHaveProperty("publicadaPor")

    const borrador = await request(app.getHttpServer())
      .get(`${base(ids.cliente)}/borrador`)
      .set(como("entrenador"))
      .expect(200)
    expect(LecturaBorradorDietaSchema.parse(borrador.body).borrador).toBeNull()

    // El reintento con la misma operación devuelve lo mismo y no publica otra vez.
    const repetida = await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/publicar`)
      .set(como("entrenador"))
      .send({ operacionId, revision })
      .expect(200)
    expect(DietaPublicadaSchema.parse(repetida.body).id).toBe(publicada.id)

    const reutilizada = await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/publicar`)
      .set(como("entrenador"))
      .send({ operacionId, revision: revision + 5 })
      .expect(409)
    expect(reutilizada.body.codigo).toBe("operacion_incompatible")
  })

  it("una segunda publicación archiva la primera y deja una sola vigente", async () => {
    const { app, como, ids, prisma } = entorno
    const revision = await guardar(ids.cliente, 0, "Segunda dieta")
    await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/publicar`)
      .set(como("nutricionista"))
      .send({ operacionId: randomUUID(), revision })
      .expect(200)
    expect(await vigente("cliente")).toBe("Segunda dieta")
    const estados = await prisma.dieta.groupBy({
      by: ["estado"],
      where: { clienteId: ids.cliente },
      _count: true,
    })
    expect(Object.fromEntries(estados.map((fila) => [fila.estado, fila._count]))).toEqual({
      publicada: 1,
      archivada: 1,
    })
  })

  it("publicar sin borrador o con una revisión obsoleta no cambia nada", async () => {
    const { app, como, ids } = entorno
    const sinBorrador = await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/publicar`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), revision: 1 })
      .expect(409)
    expect(sinBorrador.body.codigo).toBe("revision_obsoleta")

    const revision = await guardar(ids.cliente, 0, "Borrador tardío")
    const obsoleta = await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/publicar`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), revision: revision - 1 })
      .expect(409)
    expect(obsoleta.body.codigo).toBe("revision_obsoleta")
    expect(await vigente("cliente")).toBe("Segunda dieta")
  })

  it("descartar exige la revisión vigente y borra solo el borrador", async () => {
    const { app, como, ids } = entorno
    const actual = LecturaBorradorDietaSchema.parse(
      (
        await request(app.getHttpServer())
          .get(`${base(ids.cliente)}/borrador`)
          .set(como("entrenador"))
      ).body,
    ).borrador
    expect(actual).not.toBeNull()
    await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/descartar`)
      .set(como("entrenador"))
      .send({ revision: (actual?.revision ?? 0) + 1 })
      .expect(409)
    await request(app.getHttpServer())
      .post(`${base(ids.cliente)}/borrador/descartar`)
      .set(como("entrenador"))
      .send({ revision: actual?.revision })
      .expect(204)
    expect(await vigente("cliente")).toBe("Segunda dieta")
  })

  it("un guardado y una publicación simultáneos no dejan dos borradores ni dos publicadas", async () => {
    const { app, como, ids, prisma } = entorno
    const revision = await guardar(ids.pendiente, 0, "Carrera")
    const servidor = app.getHttpServer()
    await Promise.all([
      request(servidor)
        .post(`${base(ids.pendiente)}/borrador/publicar`)
        .set(como("entrenador"))
        .send({ operacionId: randomUUID(), revision }),
      request(servidor)
        .put(`${base(ids.pendiente)}/borrador`)
        .set(como("entrenador"))
        .send({ revision, documento: documentoDeObjetivos("Cambio a la vez") }),
      request(servidor)
        .put(`${base(ids.pendiente)}/borrador`)
        .set(como("entrenador"))
        .send({ revision: 0, documento: documentoDeObjetivos("Otro borrador") }),
    ])
    for (const estado of ["borrador", "publicada"] as const) {
      expect(
        await prisma.dieta.count({ where: { clienteId: ids.pendiente, estado } }),
      ).toBeLessThanOrEqual(1)
    }
  })

  it("permisos: el cliente lee solo la suya y nadie más publica", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer())
      .get(`${base(ids.cliente)}/dieta`)
      .set(como("otro"))
      .expect(403)
    for (const cuenta of ["cliente", "otro", "nutriAjeno", "empleado"] as const) {
      await request(app.getHttpServer())
        .post(`${base(ids.cliente)}/borrador/publicar`)
        .set(como(cuenta))
        .send({ operacionId: randomUUID(), revision: 1 })
        .expect(403)
      await request(app.getHttpServer())
        .post(`${base(ids.cliente)}/borrador/descartar`)
        .set(como(cuenta))
        .send({ revision: 1 })
        .expect(403)
    }
    for (const cuenta of ["nutriAjeno", "empleado"] as const) {
      await request(app.getHttpServer())
        .get(`${base(ids.cliente)}/dieta`)
        .set(como(cuenta))
        .expect(403)
    }
    await request(app.getHttpServer())
      .get(`${base(ids.cliente)}/dieta`)
      .expect(401)
    await request(app.getHttpServer())
      .post(`${base(ids.desactivado)}/borrador/publicar`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), revision: 1 })
      .expect(409)
  })
})
