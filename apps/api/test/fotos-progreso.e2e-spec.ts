import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  ListadoFotosSchema,
  MedioFotoSchema,
  VERSION_CONSENTIMIENTO,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"

// Imágenes y personas sintéticas: ninguna foto es de nadie.
describe("Fotos de progreso: el cliente sube las suyas cuando quiere", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const jpeg = jpegSintetico()
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("fotos-progreso")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const cliente = () => entorno.ids.cliente!

  const subida = (cambios: Record<string, unknown> = {}, rol = "cliente") =>
    request(http())
      .post("/medios/subidas")
      .set(entorno.como(rol))
      .send({
        operacionId: randomUUID(),
        clienteId: cliente(),
        destino: { tipo: "progreso" },
        vista: "frente",
        etiqueta: null,
        fechaToma: "2026-09-26",
        tipoMime: "image/jpeg",
        bytes: jpeg.length,
        ...cambios,
      })
  const confirmar = (medioId: string, rol = "cliente") =>
    request(http()).post(`/medios/${medioId}/confirmacion`).set(entorno.como(rol))
  const listado = async (rol: string) =>
    ListadoFotosSchema.parse(
      (
        await request(http())
          .get(`/seguimiento/clientes/${cliente()}/fotos`)
          .set(entorno.como(rol))
          .expect(200)
      ).body,
    ).fotos
  const codigo = (respuesta: request.Response) => ErrorDeApiSchema.parse(respuesta.body).codigo

  /** Intención, subida directa al almacén y confirmación, como hace la app. */
  async function subirYConfirmar(cambios: Record<string, unknown> = {}) {
    const { medio, subida: enlace } = IntencionSubidaSchema.parse(
      (await subida(cambios).expect(201)).body,
    )
    await request(http())
      .put(rutaDeEnlace(enlace!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    return MedioFotoSchema.parse((await confirmar(medio.id).expect(200)).body)
  }

  it("el cliente sube y confirma su foto, la ve en su listado y su entrenador también", async () => {
    const { medio, subida: enlace } = IntencionSubidaSchema.parse(
      (await subida({ vista: "perfilDerecho" }).expect(201)).body,
    )
    expect(medio).toMatchObject({
      estado: "pendiente",
      origen: "cliente",
      vista: "perfilDerecho",
      solicitudId: null,
      valoracionId: null,
      autor: { id: cliente() },
    })
    expect(enlace).not.toBeNull()
    // Aún sin confirmar no existe para nadie.
    expect((await listado("cliente")).map((f) => f.id)).not.toContain(medio.id)

    await request(http())
      .put(rutaDeEnlace(enlace!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    const confirmada = MedioFotoSchema.parse((await confirmar(medio.id).expect(200)).body)
    expect(confirmada).toMatchObject({
      id: medio.id,
      estado: "disponible",
      fechaToma: "2026-09-26",
    })

    for (const rol of ["cliente", "entrenador"]) {
      const foto = (await listado(rol)).find((f) => f.id === medio.id)
      expect(foto).toMatchObject({ origen: "cliente", estado: "disponible", solicitudId: null })
      await request(http()).get(`/medios/${medio.id}/acceso`).set(entorno.como(rol)).expect(200)
    }
    await request(http())
      .get(`/medios/${medio.id}/acceso`)
      .set(entorno.como("nutricionista"))
      .expect(403)
    await request(http()).get(`/medios/${medio.id}/acceso`).set(entorno.como("otro")).expect(404)
  })

  it("admite cualquier vista, también «otra» con su etiqueta", async () => {
    const brazo = await subirYConfirmar({ vista: "otra", etiqueta: "Brazo" })
    expect(brazo).toMatchObject({ vista: "otra", etiqueta: "Brazo", origen: "cliente" })
    await subida({ vista: "otra", etiqueta: null }).expect(400)
  })

  it("nadie la sube en nombre del cliente: ni su entrenador, ni otro cliente, ni el nutricionista", async () => {
    const intentos = [
      { rol: "entrenador", estado: 403 },
      { rol: "nutricionista", estado: 403 },
      { rol: "empleado", estado: 403 },
      // Quien no puede ver al cliente recibe lo mismo que si no existiera.
      { rol: "otro", estado: 404 },
    ]
    for (const { rol, estado } of intentos) {
      const operacionId = randomUUID()
      await subida({ operacionId }, rol).expect(estado)
      expect(await entorno.prisma.medioFoto.count({ where: { operacionId } })).toBe(0)
    }
    // Una foto de progreso ajena tampoco se confirma ni se lee.
    const propia = await subirYConfirmar()
    await confirmar(propia.id, "otro").expect(404)
    await confirmar(propia.id, "entrenador").expect(403)
  })

  it("sin consentimiento vigente responde 409 consentimiento_pendiente y no crea nada", async () => {
    const retirar = () =>
      request(http()).delete("/consentimiento").set(entorno.como("cliente")).expect(200)
    const aceptar = () =>
      request(http())
        .post("/consentimiento")
        .set(entorno.como("cliente"))
        .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
        .expect(201)

    await retirar()
    try {
      const operacionId = randomUUID()
      expect(codigo(await subida({ operacionId }).expect(409))).toBe("consentimiento_pendiente")
      expect(await entorno.prisma.medioFoto.count({ where: { operacionId } })).toBe(0)
    } finally {
      await aceptar()
    }

    // Retirado entre la subida y la confirmación: la foto no pasa a disponible.
    const { medio, subida: enlace } = IntencionSubidaSchema.parse((await subida().expect(201)).body)
    await request(http())
      .put(rutaDeEnlace(enlace!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    await retirar()
    try {
      expect(codigo(await confirmar(medio.id).expect(409))).toBe("consentimiento_pendiente")
    } finally {
      await aceptar()
    }
    expect(MedioFotoSchema.parse((await confirmar(medio.id).expect(200)).body).estado).toBe(
      "disponible",
    )
  })

  it("la misma operación con el mismo contenido devuelve la misma foto; con otro, 409", async () => {
    const operacionId = randomUUID()
    const primera = IntencionSubidaSchema.parse((await subida({ operacionId }).expect(201)).body)
    // Respuesta perdida: el reintento da la misma foto y un enlace nuevo.
    const reintento = IntencionSubidaSchema.parse((await subida({ operacionId }).expect(201)).body)
    expect(reintento.medio.id).toBe(primera.medio.id)
    expect(reintento.subida).not.toBeNull()

    for (const cambio of [
      { vista: "espalda" },
      { fechaToma: "2026-09-25" },
      { vista: "otra", etiqueta: "Brazo" },
    ])
      expect(codigo(await subida({ operacionId, ...cambio }).expect(409))).toBe(
        "operacion_incompatible",
      )

    await request(http())
      .put(rutaDeEnlace(reintento.subida!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    await confirmar(primera.medio.id).expect(200)
    // Ya confirmada: la misma operación la devuelve disponible y sin nada que subir.
    const confirmada = IntencionSubidaSchema.parse((await subida({ operacionId }).expect(201)).body)
    expect(confirmada).toMatchObject({
      medio: { id: primera.medio.id, estado: "disponible" },
      subida: null,
    })
    expect(await entorno.prisma.medioFoto.count({ where: { operacionId } })).toBe(1)
  })

  it("una operación no cambia de destino: progreso y solicitud no se confunden", async () => {
    const solicitud = await entorno.prisma.solicitudFotos.create({
      data: {
        clienteId: cliente(),
        autorId: entorno.ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
      },
    })
    const aSolicitud = { destino: { tipo: "solicitud", solicitudId: solicitud.id } }

    const deProgreso = randomUUID()
    await subida({ operacionId: deProgreso }).expect(201)
    expect(codigo(await subida({ operacionId: deProgreso, ...aSolicitud }).expect(409))).toBe(
      "operacion_incompatible",
    )

    const deSolicitud = randomUUID()
    await subida({ operacionId: deSolicitud, ...aSolicitud }).expect(201)
    expect(codigo(await subida({ operacionId: deSolicitud }).expect(409))).toBe(
      "operacion_incompatible",
    )
    // Una foto de progreso no da por recibida ninguna solicitud.
    await subirYConfirmar()
    expect(
      (await entorno.prisma.solicitudFotos.findUniqueOrThrow({ where: { id: solicitud.id } }))
        .estado,
    ).toBe("pendiente")
  })

  it("si el entrenador la incorpora a una visita, el reintento del cliente sigue siendo la misma foto", async () => {
    const operacionId = randomUUID()
    const { medio, subida: enlace } = IntencionSubidaSchema.parse(
      (await subida({ operacionId }).expect(201)).body,
    )
    await request(http())
      .put(rutaDeEnlace(enlace!.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
    await confirmar(medio.id).expect(200)
    const visita = await entorno.prisma.valoracion.create({
      data: { clienteId: cliente(), autorId: entorno.ids.entrenador!, tipo: "revision" },
    })
    await entorno.prisma.medioFoto.update({
      where: { id: medio.id },
      data: { valoracionId: visita.id },
    })

    const repetida = IntencionSubidaSchema.parse((await subida({ operacionId }).expect(201)).body)
    expect(repetida).toMatchObject({
      medio: { id: medio.id, valoracionId: visita.id },
      subida: null,
    })
  })

  it("el cliente puede retirar su foto de progreso; su historial la muestra retirada", async () => {
    const foto = await subirYConfirmar({ vista: "espalda" })
    const retirada = MedioFotoSchema.parse(
      (await request(http()).delete(`/medios/${foto.id}`).set(entorno.como("cliente")).expect(200))
        .body,
    )
    expect(retirada.estado).toBe("eliminado")
    expect((await listado("entrenador")).find((f) => f.id === foto.id)?.estado).toBe("eliminado")
    await request(http()).get(`/medios/${foto.id}/acceso`).set(entorno.como("cliente")).expect(404)
  })
})
