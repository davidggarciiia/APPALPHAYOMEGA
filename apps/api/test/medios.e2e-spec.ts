import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  AccesoMedioSchema,
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  MedioFotoSchema,
  type EnlaceTemporal,
} from "@alpha-omega/shared"

import { ALMACEN_OBJETOS, AlmacenLocal } from "../src/medios/almacen-objetos.js"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico } from "./imagenes-ayuda.js"

const pngSintetico = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

describe("Fotos privadas: subida, confirmación y acceso (F02b)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let valoracionId: string
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("medios")
    const valoracion = await entorno.prisma.valoracion.create({
      data: { clienteId: entorno.ids.cliente!, autorId: entorno.ids.entrenador!, tipo: "inicial" },
    })
    valoracionId = valoracion.id
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const jpeg = jpegSintetico()

  const intencion = (cambios: Record<string, unknown> = {}, rol = "entrenador") =>
    request(http())
      .post("/medios/subidas")
      .set(entorno.como(rol))
      .send({
        operacionId: randomUUID(),
        clienteId: entorno.ids.cliente!,
        destino: { tipo: "valoracion", valoracionId },
        vista: "frente",
        etiqueta: null,
        fechaToma: "2026-09-24",
        tipoMime: "image/jpeg",
        bytes: jpeg.length,
        ...cambios,
      })

  /** Ruta relativa de un enlace del almacén local, para llamarlo con supertest. */
  const ruta = (enlace: EnlaceTemporal) => {
    const url = new URL(enlace.url)
    return `${url.pathname}${url.search}`
  }
  const subir = (enlace: EnlaceTemporal, cuerpo: Buffer, tipo = "image/jpeg") =>
    request(http()).put(ruta(enlace)).set("Content-Type", tipo).send(cuerpo)

  it("sube, confirma sin metadatos y da acceso temporal solo a quien corresponde", async () => {
    const operacionId = randomUUID()
    await intencion({ operacionId }, "cliente").expect(403)
    await intencion({ operacionId }, "nutricionista").expect(403)
    const { medio, subida } = IntencionSubidaSchema.parse(
      (await intencion({ operacionId }).expect(201)).body,
    )
    expect(medio).toMatchObject({ estado: "pendiente", origen: "profesional", valoracionId })
    expect(JSON.stringify(medio)).not.toContain("clientes/")
    expect(subida).not.toBeNull()

    // Respuesta perdida: la misma operación devuelve el mismo medio.
    const otra = IntencionSubidaSchema.parse((await intencion({ operacionId }).expect(201)).body)
    expect(otra.medio.id).toBe(medio.id)
    const distinta = await intencion({ operacionId, vista: "espalda" }).expect(409)
    expect(ErrorDeApiSchema.parse(distinta.body).codigo).toBe("operacion_incompatible")

    const confirmar = () =>
      request(http()).post(`/medios/${medio.id}/confirmacion`).set(entorno.como("entrenador"))
    expect(ErrorDeApiSchema.parse((await confirmar().expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )
    await subir(subida!, jpeg).expect(204)
    const disponible = MedioFotoSchema.parse((await confirmar().expect(200)).body)
    expect(disponible.estado).toBe("disponible")
    expect(MedioFotoSchema.parse((await confirmar().expect(200)).body).id).toBe(medio.id)

    const { lectura } = AccesoMedioSchema.parse(
      (
        await request(http())
          .get(`/medios/${medio.id}/acceso`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    const servida = await request(http()).get(ruta(lectura)).expect(200)
    expect(servida.headers["cache-control"]).toContain("no-store")
    const bytes = Buffer.from(servida.body as Buffer)
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
    expect(bytes.toString("latin1")).not.toContain("GPS")
    expect(bytes.toString("latin1")).not.toContain("comentario")

    // Una foto profesional no publicada no es visible para el cliente; nadie más la ve.
    await request(http()).get(`/medios/${medio.id}/acceso`).set(entorno.como("cliente")).expect(404)
    await request(http())
      .get(`/medios/${medio.id}/acceso`)
      .set(entorno.como("nutricionista"))
      .expect(403)
    await request(http()).get(`/medios/${medio.id}/acceso`).set(entorno.como("otro")).expect(404)
  })

  it("rechaza firmas ajenas o caducadas, tamaños excesivos y formatos falseados", async () => {
    const { medio, subida } = IntencionSubidaSchema.parse((await intencion().expect(201)).body)
    const url = new URL(subida!.url)
    url.searchParams.set("firma", "falsa")
    await request(http())
      .put(`${url.pathname}${url.search}`)
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(403)

    const almacen = entorno.app.get<AlmacenLocal>(ALMACEN_OBJETOS)
    const clave = decodeURIComponent(new URL(subida!.url).pathname.split("/").pop()!)
    const caducado = almacen.enlaceDeSubida(
      clave,
      "image/jpeg",
      jpeg.length,
      new Date(Date.now() - 1000),
    )
    await subir(caducado, jpeg).expect(403)

    await subir(subida!, Buffer.concat([jpeg, Buffer.alloc(10)])).expect(413)
    await subir(subida!, jpeg, "image/png").expect(400)

    // Un PNG disfrazado de JPEG llega al almacén pero no se confirma.
    await subir(subida!, pngSintetico).expect(204)
    const falseada = await request(http())
      .post(`/medios/${medio.id}/confirmacion`)
      .set(entorno.como("entrenador"))
      .expect(400)
    expect(ErrorDeApiSchema.parse(falseada.body).codigo).toBe("solicitud_invalida")
    expect(
      (await entorno.prisma.medioFoto.findUniqueOrThrow({ where: { id: medio.id } })).estado,
    ).toBe("pendiente")
    await request(http())
      .get(`/medios/${medio.id}/acceso`)
      .set(entorno.como("entrenador"))
      .expect(404)
  })

  it("una intención de otro cliente o de una visita ajena no se crea", async () => {
    await intencion({ clienteId: entorno.ids.otro! }).expect(404)
    await intencion({ destino: { tipo: "valoracion", valoracionId: randomUUID() } }).expect(404)
    await intencion({ tipoMime: "image/gif" }).expect(400)
    await intencion({ bytes: 9 * 1024 * 1024 }).expect(400)
  })
})
