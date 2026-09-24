import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  ListadoFotosSchema,
  MedioFotoSchema,
  ValoracionProfesionalSchema,
  type DefinicionCorporal,
  type ValoracionProfesional,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"

// Datos e imágenes sintéticos, en la base y el almacén desechables de pruebas.
const peso: DefinicionCorporal = {
  id: randomUUID(),
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
  activa: true,
}

describe("Fotos de una valoración (F02c)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let visita: ValoracionProfesional
  const jpeg = jpegSintetico()
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("valoraciones-fotos")
    const http = entorno.app.getHttpServer()
    const base = `/seguimiento/clientes/${entorno.ids.cliente!}`
    await request(http)
      .put(`${base}/plantilla-valoracion`)
      .set(entorno.como("entrenador"))
      .send({ revision: 0, corporales: [peso], pruebas: [] })
      .expect(200)
    const creada = ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .post(`${base}/valoraciones`)
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: ["medidas", "fotos"],
          })
          .expect(201)
      ).body,
    )
    visita = ValoracionProfesionalSchema.parse(
      (
        await request(http)
          .put(`${base}/valoraciones/${creada.id}`)
          .set(entorno.como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: {
              bloques: ["medidas", "fotos"],
              corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80 }],
              pruebas: [],
              grasaPorPliegues: null,
              destacados: [],
              conclusion: null,
              notasInternas: null,
            },
          })
          .expect(200)
      ).body,
    )
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const ruta = (resto: string) => `/seguimiento/clientes/${entorno.ids.cliente!}/${resto}`

  async function fotoConfirmada(
    rol: "entrenador" | "cliente",
    destino: Record<string, unknown>,
  ): Promise<string> {
    const { medio, subida } = IntencionSubidaSchema.parse(
      (
        await request(http())
          .post("/medios/subidas")
          .set(entorno.como(rol))
          .send({
            operacionId: randomUUID(),
            clienteId: entorno.ids.cliente!,
            destino,
            vista: "frente",
            etiqueta: null,
            fechaToma: "2026-09-24",
            tipoMime: "image/jpeg",
            bytes: jpeg.length,
          })
          .expect(201)
      ).body,
    )
    await request(http())
      .put(rutaDeEnlace(subida!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    await request(http())
      .post(`/medios/${medio.id}/confirmacion`)
      .set(entorno.como(rol))
      .expect(200)
    return medio.id
  }

  it("la foto del entrenador es privada hasta publicar la visita; después la ve el cliente", async () => {
    const medioId = await fotoConfirmada("entrenador", {
      tipo: "valoracion",
      valoracionId: visita.id,
    })
    const listaEntrenador = ListadoFotosSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${visita.id}/fotos`))
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(listaEntrenador.fotos.map((f) => f.id)).toEqual([medioId])
    await request(http())
      .get(ruta(`valoraciones/${visita.id}/fotos`))
      .set(entorno.como("cliente"))
      .expect(404)
    await request(http())
      .get(ruta(`valoraciones/${visita.id}/fotos`))
      .set(entorno.como("nutricionista"))
      .expect(403)
    await request(http()).get(`/medios/${medioId}/acceso`).set(entorno.como("cliente")).expect(404)

    await request(http())
      .post(ruta(`valoraciones/${visita.id}/publicaciones`))
      .set(entorno.como("entrenador"))
      .send({
        operacionId: randomUUID(),
        borradorId: visita.borrador!.id,
        revision: visita.borrador!.revision,
        sustituyePublicacionId: null,
      })
      .expect(201)
    const listaCliente = ListadoFotosSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${visita.id}/fotos`))
          .set(entorno.como("cliente"))
          .expect(200)
      ).body,
    )
    expect(listaCliente.fotos.map((f) => f.id)).toEqual([medioId])
    await request(http()).get(`/medios/${medioId}/acceso`).set(entorno.como("cliente")).expect(200)
  })

  it("incorpora una aportación del cliente sin volver a subirla ni cambiar su autor", async () => {
    const { prisma, ids } = entorno
    const solicitud = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
      },
    })
    const aportada = await fotoConfirmada("cliente", {
      tipo: "solicitud",
      solicitudId: solicitud.id,
    })
    expect(
      (await prisma.solicitudFotos.findUniqueOrThrow({ where: { id: solicitud.id } })).estado,
    ).toBe("recibida")

    // La visita publicada no admite fotos nuevas hasta abrir una corrección.
    const cerrada = await request(http())
      .post(ruta(`valoraciones/${visita.id}/fotos`))
      .set(entorno.como("entrenador"))
      .send({ medioId: aportada })
      .expect(409)
    expect(ErrorDeApiSchema.parse(cerrada.body).codigo).toBe("estado_incompatible")
    const correccion = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .post(ruta("valoraciones"))
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            corrigePublicacionId: (
              await prisma.publicacionValoracion.findFirstOrThrow({
                where: { valoracionId: visita.id },
              })
            ).id,
          })
          .expect(201)
      ).body,
    )
    const vincular = () =>
      request(http())
        .post(ruta(`valoraciones/${correccion.id}/fotos`))
        .set(entorno.como("entrenador"))
        .send({ medioId: aportada })
    await request(http())
      .post(ruta(`valoraciones/${correccion.id}/fotos`))
      .set(entorno.como("cliente"))
      .send({ medioId: aportada })
      .expect(403)
    const vinculada = MedioFotoSchema.parse((await vincular().expect(201)).body)
    expect(vinculada).toMatchObject({
      id: aportada,
      origen: "cliente",
      autor: expect.objectContaining({ id: ids.cliente! }),
      solicitudId: solicitud.id,
      valoracionId: visita.id,
    })
    expect(MedioFotoSchema.parse((await vincular().expect(201)).body).id).toBe(aportada)
    expect(await prisma.medioFoto.count({ where: { clienteId: ids.cliente! } })).toBe(2)
  })

  it("rechaza fotos pendientes, de otro cliente o inexistentes", async () => {
    const { prisma, ids } = entorno
    const pendiente = await prisma.medioFoto.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        origen: "profesional",
        vista: "espalda",
        fechaToma: new Date("2026-09-24T00:00:00Z"),
        tipoMime: "image/jpeg",
        bytes: 100,
        clave: `clientes/${ids.cliente!}/${randomUUID()}`,
        subidaCaducaEn: new Date(Date.now() + 60_000),
        valoracionId: visita.id,
      },
    })
    const vincular = (medioId: string) =>
      request(http())
        .post(ruta(`valoraciones/${visita.id}/fotos`))
        .set(entorno.como("entrenador"))
        .send({ medioId })
    expect(ErrorDeApiSchema.parse((await vincular(pendiente.id).expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )
    await vincular(randomUUID()).expect(404)
    const ajena = await prisma.medioFoto.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        origen: "profesional",
        vista: "frente",
        fechaToma: new Date("2026-09-24T00:00:00Z"),
        tipoMime: "image/jpeg",
        bytes: 100,
        clave: `clientes/${ids.otro!}/${randomUUID()}`,
        subidaCaducaEn: new Date(Date.now() + 60_000),
        valoracionId: (
          await prisma.valoracion.create({
            data: { clienteId: ids.otro!, autorId: ids.entrenador!, tipo: "inicial" },
          })
        ).id,
        estado: "disponible",
        confirmadoEn: new Date(),
      },
    })
    await vincular(ajena.id).expect(404)
  })
})
