import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  ListadoSolicitudesFotosSchema,
  SolicitudFotosSchema,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"

// Imágenes sintéticas; el cliente de prueba aún no tiene ninguna valoración.
describe("Solicitudes de fotos (F04a)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const jpeg = jpegSintetico()
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("solicitudes-fotos")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const ruta = (resto = "") =>
    `/seguimiento/clientes/${entorno.ids.cliente!}/solicitudes-fotos${resto}`
  const pedir = (cambios: Record<string, unknown> = {}, rol = "entrenador") =>
    request(http())
      .post(ruta())
      .set(entorno.como(rol))
      .send({
        operacionId: randomUUID(),
        vistas: ["frente", "espalda"],
        fechaLimite: "2026-10-01",
        mensaje: "Con la misma luz que la última vez",
        ...cambios,
      })
  const aportar = (solicitudId: string, vista = "frente", rol = "cliente") =>
    request(http())
      .post("/medios/subidas")
      .set(entorno.como(rol))
      .send({
        operacionId: randomUUID(),
        clienteId: entorno.ids.cliente!,
        destino: { tipo: "solicitud", solicitudId },
        vista,
        etiqueta: null,
        fechaToma: "2026-09-25",
        tipoMime: "image/jpeg",
        bytes: jpeg.length,
      })

  it("el entrenador pide fotos sin visita previa y un reintento no duplica la solicitud", async () => {
    const operacionId = randomUUID()
    await pedir({ operacionId }, "cliente").expect(403)
    await pedir({ operacionId }, "nutricionista").expect(403)
    const creada = SolicitudFotosSchema.parse((await pedir({ operacionId }).expect(201)).body)
    expect(creada).toMatchObject({ estado: "pendiente", vistas: ["frente", "espalda"], medios: [] })
    expect(SolicitudFotosSchema.parse((await pedir({ operacionId }).expect(201)).body).id).toBe(
      creada.id,
    )
    expect(
      ErrorDeApiSchema.parse((await pedir({ operacionId, vistas: ["frente"] }).expect(409)).body)
        .codigo,
    ).toBe("operacion_incompatible")
    expect(
      ListadoSolicitudesFotosSchema.parse(
        (await request(http()).get(ruta()).set(entorno.como("cliente")).expect(200)).body,
      ).solicitudes.map((s) => s.id),
    ).toEqual([creada.id])
    await request(http()).get(ruta()).set(entorno.como("nutricionista")).expect(403)
    await request(http()).get(ruta()).set(entorno.como("otro")).expect(403)
  })

  it("el cliente aporta solo lo pedido; recibir no es revisar", async () => {
    const solicitud = SolicitudFotosSchema.parse((await pedir().expect(201)).body)
    const revisar = (operacionId = randomUUID()) =>
      request(http())
        .post(ruta(`/${solicitud.id}/revision`))
        .set(entorno.como("entrenador"))
        .send({ operacionId })
    expect(ErrorDeApiSchema.parse((await revisar().expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )
    await aportar(solicitud.id, "perfilIzquierdo").expect(400)
    await aportar(solicitud.id, "frente", "entrenador").expect(403)

    const { medio, subida } = IntencionSubidaSchema.parse(
      (await aportar(solicitud.id).expect(201)).body,
    )
    expect(medio).toMatchObject({
      origen: "cliente",
      solicitudId: solicitud.id,
      valoracionId: null,
    })
    await request(http())
      .put(rutaDeEnlace(subida!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    await request(http())
      .post(`/medios/${medio.id}/confirmacion`)
      .set(entorno.como("cliente"))
      .expect(200)
    // El cliente ve su propia aportación; el entrenador responsable también.
    await request(http()).get(`/medios/${medio.id}/acceso`).set(entorno.como("cliente")).expect(200)
    await request(http())
      .get(`/medios/${medio.id}/acceso`)
      .set(entorno.como("entrenador"))
      .expect(200)

    const recibida = ListadoSolicitudesFotosSchema.parse(
      (await request(http()).get(ruta()).set(entorno.como("entrenador")).expect(200)).body,
    ).solicitudes.find((s) => s.id === solicitud.id)!
    expect(recibida).toMatchObject({ estado: "recibida", revisadaEn: null })
    expect(recibida.medios.map((m) => m.id)).toEqual([medio.id])

    const operacionId = randomUUID()
    await request(http())
      .post(ruta(`/${solicitud.id}/revision`))
      .set(entorno.como("cliente"))
      .send({ operacionId })
      .expect(403)
    const revisada = SolicitudFotosSchema.parse((await revisar(operacionId).expect(200)).body)
    expect(revisada.estado).toBe("revisada")
    expect(
      SolicitudFotosSchema.parse((await revisar(operacionId).expect(200)).body).revisadaEn,
    ).toBe(revisada.revisadaEn)
    expect(ErrorDeApiSchema.parse((await revisar().expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )
    expect(ErrorDeApiSchema.parse((await aportar(solicitud.id).expect(409)).body).codigo).toBe(
      "estado_incompatible",
    )
  })

  it("no se aporta a solicitudes ajenas o inexistentes", async () => {
    const { prisma, ids } = entorno
    const ajena = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
      },
    })
    await aportar(ajena.id).expect(404)
    await aportar(randomUUID()).expect(404)
  })
})
