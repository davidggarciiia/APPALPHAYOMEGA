import { jest } from "@jest/globals"
import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  AccesoMedioSchema,
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  ListadoFotosSchema,
  ListadoSolicitudesFotosSchema,
  MedioFotoSchema,
  SolicitudFotosSchema,
  type DestinoMedio,
  type EnlaceTemporal,
  type IntencionSubida,
} from "@alpha-omega/shared"

import {
  ALMACEN_OBJETOS,
  AlmacenLocal,
  type AlmacenObjetos,
} from "../src/medios/almacen-objetos.js"
import { LimpiezaMedios } from "../src/medios/limpieza-medios.js"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"

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

  it("un enlace de subida reutilizado no puede reemplazar la foto ya confirmada", async () => {
    const { medio, subida } = IntencionSubidaSchema.parse((await intencion().expect(201)).body)
    await subir(subida!, jpeg).expect(204)
    await request(http())
      .post(`/medios/${medio.id}/confirmacion`)
      .set(entorno.como("entrenador"))
      .expect(200)

    const { lectura } = AccesoMedioSchema.parse(
      (
        await request(http())
          .get(`/medios/${medio.id}/acceso`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    const limpia = Buffer.from(
      (await request(http()).get(ruta(lectura)).expect(200)).body as Buffer,
    )
    expect(limpia.toString("latin1")).not.toContain("GPS")

    // La firma sigue vigente, pero solo permite escribir el temporal de subida.
    const reemplazo = Buffer.from(jpeg)
    reemplazo[reemplazo.length - 3] = 0x79
    await subir(subida!, reemplazo).expect(204)
    const final = await request(http()).get(ruta(lectura)).expect(200)
    expect(Buffer.from(final.body as Buffer)).toEqual(limpia)
    expect(Buffer.from(final.body as Buffer).toString("latin1")).not.toContain("GPS")

    const almacen = entorno.app.get<AlmacenObjetos>(ALMACEN_OBJETOS)
    const temporal = decodeURIComponent(new URL(subida!.url).pathname.split("/").pop()!)
    expect(await almacen.leer(temporal)).not.toBeNull()
    const limpieza = entorno.app.get(LimpiezaMedios)
    const despuesDeCaducar = new Date(Date.now() + 2 * 60 * 60_000)
    const borrar = almacen.borrar.bind(almacen)
    const espia = jest.spyOn(almacen, "borrar").mockImplementation(async (clave) => {
      if (clave === temporal) throw new Error("Fallo de limpieza simulado")
      return borrar(clave)
    })
    try {
      await limpieza.limpiar(despuesDeCaducar)
      expect(await almacen.leer(temporal)).not.toBeNull()
    } finally {
      espia.mockRestore()
    }
    await limpieza.limpiar(despuesDeCaducar)
    expect(await almacen.leer(temporal)).toBeNull()
    expect(
      Buffer.from((await request(http()).get(ruta(lectura)).expect(200)).body as Buffer),
    ).toEqual(limpia)
    expect(
      (await entorno.prisma.medioFoto.findUniqueOrThrow({ where: { id: medio.id } })).estado,
    ).toBe("disponible")
  })

  it("una escritura lenta no reemplaza la foto que confirmó otro intento", async () => {
    const { medio, subida } = IntencionSubidaSchema.parse((await intencion().expect(201)).body)
    await subir(subida!, jpeg).expect(204)
    const almacen = entorno.app.get<AlmacenObjetos>(ALMACEN_OBJETOS)
    const reemplazar = almacen.reemplazar.bind(almacen)
    const transaccion = entorno.prisma.$transaction.bind(entorno.prisma)
    // Reproduce el vencimiento real de una transacción sin esperar 30 segundos.
    const reloj = jest
      .spyOn(entorno.prisma, "$transaction")
      .mockImplementation(((
        operacion: Parameters<typeof transaccion>[0],
        opciones?: Parameters<typeof transaccion>[1],
      ) => transaccion(operacion, { ...opciones, timeout: 150 })) as typeof transaccion)
    let avisar!: () => void
    let continuar!: () => void
    const escribiendo = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const retenida = new Promise<void>((resolve) => {
      continuar = resolve
    })
    const escritura = jest
      .spyOn(almacen, "reemplazar")
      .mockImplementationOnce(async (objeto, datos) => {
        avisar()
        await retenida
        await reemplazar(objeto, datos)
      })
    const primera = request(http())
      .post(`/medios/${medio.id}/confirmacion`)
      .set(entorno.como("entrenador"))
      .on("response", avisar)
      .then((respuesta) => respuesta)
    try {
      await escribiendo
      await new Promise((resolve) => setTimeout(resolve, 300))
      const otraFoto = Buffer.from(jpeg)
      otraFoto[otraFoto.length - 3] = 0x79
      await subir(subida!, otraFoto).expect(204)
      let segunda!: request.Response
      const recibida = new Promise<void>((resolve) => {
        void request(http())
          .post(`/medios/${medio.id}/confirmacion`)
          .set(entorno.como("entrenador"))
          .on("response", (respuesta) => {
            segunda = respuesta
            resolve()
          })
          .then(() => undefined)
      })
      await recibida
      expect(segunda.status).toBe(200)
      const ganadora = await entorno.prisma.medioFoto.findUniqueOrThrow({ where: { id: medio.id } })
      const contenidoGanador = await almacen.leer(ganadora.clave)
      continuar()
      await primera
      expect(await almacen.leer(ganadora.clave)).toEqual(contenidoGanador)
    } finally {
      continuar()
      await primera
      escritura.mockRestore()
      reloj.mockRestore()
    }
  })

  it("dos confirmaciones solapadas conservan la misma foto aunque se limpie su temporal", async () => {
    const { medio, subida } = IntencionSubidaSchema.parse((await intencion().expect(201)).body)
    await subir(subida!, jpeg).expect(204)
    const almacen = entorno.app.get<AlmacenObjetos>(ALMACEN_OBJETOS)
    const leer = almacen.leer.bind(almacen)
    let avisarSegunda = () => {}
    let liberarSegunda = () => {}
    const segundaDentro = new Promise<void>((resolver) => {
      avisarSegunda = resolver
    })
    const primeraTerminada = new Promise<void>((resolver) => {
      liberarSegunda = resolver
    })
    let lecturas = 0
    const espia = jest.spyOn(almacen, "leer").mockImplementation(async (clave) => {
      lecturas += 1
      if (lecturas === 1) await segundaDentro
      else if (lecturas === 2) {
        avisarSegunda()
        await primeraTerminada
      }
      return leer(clave)
    })
    const confirmar = () =>
      request(http())
        .post(`/medios/${medio.id}/confirmacion`)
        .set(entorno.como("entrenador"))
        .on("response", () => {
          // Supertest espera a cerrar su servidor antes de resolver la promesa;
          // el evento HTTP permite terminar la otra petición que sigue abierta.
          avisarSegunda()
          liberarSegunda()
        })
        .then((respuesta) => respuesta)
    const primera = confirmar()
    const segunda = confirmar()
    try {
      const una = await Promise.race([primera, segunda])
      expect(una.status).toBe(200)
      liberarSegunda()
      for (const otra of await Promise.all([primera, segunda])) {
        expect(otra.status).toBe(200)
        expect(otra.body).toEqual(una.body)
      }
    } finally {
      avisarSegunda()
      liberarSegunda()
      await Promise.allSettled([primera, segunda])
      espia.mockRestore()
    }
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
    const caducado = await almacen.enlaceDeSubida(
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

// Imágenes y personas sintéticas. Los fallos del almacén se simulan sobre el almacén local.
describe("Retirar fotos y limpiar subidas abandonadas (F05a)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let valoracionId: string
  let solicitudId: string
  let solicitudOtroId: string
  const jpeg = jpegSintetico()
  const http = () => entorno.app.getHttpServer()
  const clienteId = () => entorno.ids.cliente!
  const almacen = () => entorno.app.get<AlmacenObjetos>(ALMACEN_OBJETOS)

  const pedirFotos = async (cliente: string) =>
    SolicitudFotosSchema.parse(
      (
        await request(http())
          .post(`/seguimiento/clientes/${cliente}/solicitudes-fotos`)
          .set(entorno.como("entrenador"))
          .send({
            operacionId: randomUUID(),
            vistas: ["frente", "espalda"],
            fechaLimite: null,
            mensaje: null,
          })
          .expect(201)
      ).body,
    ).id

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("medios-retirada")
    const valoracion = await entorno.prisma.valoracion.create({
      data: { clienteId: clienteId(), autorId: entorno.ids.entrenador!, tipo: "inicial" },
    })
    valoracionId = valoracion.id
    solicitudId = await pedirFotos(clienteId())
    solicitudOtroId = await pedirFotos(entorno.ids.otro!)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  const intencion = async (
    rol: string,
    cliente: string,
    destino: DestinoMedio,
    operacionId: string = randomUUID(),
  ) =>
    IntencionSubidaSchema.parse(
      (
        await request(http())
          .post("/medios/subidas")
          .set(entorno.como(rol))
          .send({
            operacionId,
            clienteId: cliente,
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
  const subir = (enlace: EnlaceTemporal) =>
    request(http())
      .put(rutaDeEnlace(enlace.url))
      .set("Content-Type", "image/jpeg")
      .send(jpeg)
      .expect(204)
  const confirmar = async (id: string, rol: string) =>
    MedioFotoSchema.parse(
      (await request(http()).post(`/medios/${id}/confirmacion`).set(entorno.como(rol)).expect(200))
        .body,
    )
  /** Foto del entrenador subida para la visita y confirmada (vinculada). */
  const fotoDeVisita = async () => {
    const { medio, subida } = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    await subir(subida!)
    return confirmar(medio.id, "entrenador")
  }
  /** Aportación confirmada de un cliente a una solicitud suya. */
  const aportacion = async (rol = "cliente", cliente = clienteId(), solicitud = solicitudId) => {
    const { medio, subida } = await intencion(rol, cliente, {
      tipo: "solicitud",
      solicitudId: solicitud,
    })
    await subir(subida!)
    return confirmar(medio.id, rol)
  }
  const retirar = (id: string, rol: string) =>
    request(http()).delete(`/medios/${id}`).set(entorno.como(rol))
  const acceso = (id: string, rol: string) =>
    request(http()).get(`/medios/${id}/acceso`).set(entorno.como(rol))
  const fila = (id: string) => entorno.prisma.medioFoto.findUnique({ where: { id } })
  const clave = async (id: string) => (await fila(id))!.clave

  it("recupera la limpieza de una copia sin confirmar si fallaron la escritura y el borrado", async () => {
    const { medio, subida } = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    await subir(subida!)
    let copia: string | undefined
    const reemplazar = almacen().reemplazar.bind(almacen())
    const borrar = almacen().borrar.bind(almacen())
    const escritura = jest
      .spyOn(almacen(), "reemplazar")
      .mockImplementationOnce(async (objeto, datos) => {
        copia = objeto
        await reemplazar(objeto, datos)
        throw new Error("Fallo simulado después de escribir la copia")
      })
    const retirada = jest.spyOn(almacen(), "borrar").mockImplementation(async (objeto) => {
      if (objeto === copia) throw new Error("Borrado temporalmente indisponible")
      return borrar(objeto)
    })
    try {
      await request(http())
        .post(`/medios/${medio.id}/confirmacion`)
        .set(entorno.como("entrenador"))
        .expect(500)
    } finally {
      escritura.mockRestore()
      retirada.mockRestore()
    }
    expect(copia).toBeDefined()
    expect(await almacen().leer(copia!)).not.toBeNull()
    expect((await fila(medio.id))!.estado).toBe("pendiente")
    await caducadaHaceDosHoras(medio.id)
    await entorno.app.get(LimpiezaMedios).limpiar()
    expect(await fila(medio.id)).toBeNull()
    expect(await almacen().leer(copia!)).toBeNull()
    // El registro sobrevive a la intención. Incluso un PUT que acaba después
    // del borrado (o de una caída del proceso) se recupera en otro pase.
    expect(await entorno.prisma.intentoFoto.findUnique({ where: { clave: copia! } })).not.toBeNull()
    await reemplazar(copia!, jpeg)
    await entorno.app.get(LimpiezaMedios).limpiar(new Date(Date.now() + 25 * 60 * 60_000))
    expect(await almacen().leer(copia!)).toBeNull()
  })

  it("perder la respuesta del commit no borra la foto confirmada", async () => {
    const { medio, subida } = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    await subir(subida!)
    const transaccion = entorno.prisma.$transaction.bind(entorno.prisma)
    const commit = jest.spyOn(entorno.prisma, "$transaction").mockImplementationOnce((async (
      operacion: Parameters<typeof transaccion>[0],
      opciones?: Parameters<typeof transaccion>[1],
    ) => {
      await transaccion(operacion, opciones)
      throw new Error("Respuesta del commit perdida (simulado)")
    }) as unknown as typeof transaccion)
    try {
      await request(http())
        .post(`/medios/${medio.id}/confirmacion`)
        .set(entorno.como("entrenador"))
        .expect(500)
    } finally {
      commit.mockRestore()
    }
    const final = (await fila(medio.id))!
    expect(final.estado).toBe("disponible")
    expect(
      await entorno.prisma.intentoFoto.findUnique({ where: { clave: final.clave } }),
    ).toBeNull()
    const contenido = await almacen().leer(final.clave)
    expect(contenido).not.toBeNull()
    await confirmar(medio.id, "entrenador")
    await entorno.app.get(LimpiezaMedios).limpiar(new Date(Date.now() + 48 * 60 * 60_000))
    expect(await almacen().leer(final.clave)).toEqual(contenido)
  })

  it("retirar una foto disponible quita acceso y objeto, y su visita la sigue mostrando retirada", async () => {
    const foto = await fotoDeVisita()
    const objeto = await clave(foto.id)
    expect(await almacen().leer(objeto)).not.toBeNull()

    const retirada = MedioFotoSchema.parse((await retirar(foto.id, "entrenador").expect(200)).body)
    expect(retirada).toMatchObject({ id: foto.id, estado: "eliminado", valoracionId })
    const guardada = await fila(foto.id)
    expect(guardada!.eliminadoEn).not.toBeNull()
    expect(await almacen().leer(objeto)).toBeNull()
    await acceso(foto.id, "entrenador").expect(404)

    // Repetir la orden devuelve la misma foto retirada, sin cambiar cuándo se retiró.
    expect(MedioFotoSchema.parse((await retirar(foto.id, "entrenador").expect(200)).body)).toEqual(
      retirada,
    )
    expect((await fila(foto.id))!.eliminadoEn).toEqual(guardada!.eliminadoEn)

    // El historial de la visita la identifica como retirada y nada la revive.
    const { fotos } = ListadoFotosSchema.parse(
      (
        await request(http())
          .get(`/seguimiento/clientes/${clienteId()}/valoraciones/${valoracionId}/fotos`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(fotos.find((f) => f.id === foto.id)?.estado).toBe("eliminado")
    const revivir = await request(http())
      .post(`/medios/${foto.id}/confirmacion`)
      .set(entorno.como("entrenador"))
      .expect(409)
    expect(ErrorDeApiSchema.parse(revivir.body).codigo).toBe("estado_incompatible")
    expect((await fila(foto.id))!.estado).toBe("eliminado")
    await acceso(foto.id, "entrenador").expect(404)

    // Una intención sin confirmar no es una foto que retirar: la descarta la limpieza.
    const { medio } = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    const pendiente = await retirar(medio.id, "entrenador").expect(409)
    expect(ErrorDeApiSchema.parse(pendiente.body).codigo).toBe("estado_incompatible")
    expect((await fila(medio.id))!.estado).toBe("pendiente")
  })

  it("si el almacén falla, la foto queda retirándose sin acceso y un nuevo intento la retira", async () => {
    const foto = await aportacion()
    const objeto = await clave(foto.id)
    const espia = jest
      .spyOn(almacen(), "borrar")
      .mockRejectedValueOnce(new Error("almacén sin conexión (simulado)"))
    try {
      const fallo = await retirar(foto.id, "cliente").expect(503)
      expect(fallo.body.message).toMatch(/vuelve a intentarlo/i)
      expect(espia).toHaveBeenCalledTimes(1)
    } finally {
      espia.mockRestore()
    }
    expect(await fila(foto.id)).toMatchObject({ estado: "eliminando", eliminadoEn: null })
    expect(await almacen().leer(objeto)).not.toBeNull()
    await acceso(foto.id, "cliente").expect(404)
    await acceso(foto.id, "entrenador").expect(404)

    // Sigue en su solicitud con el estado real: no se da por retirada ni reaparece.
    const { solicitudes } = ListadoSolicitudesFotosSchema.parse(
      (
        await request(http())
          .get(`/seguimiento/clientes/${clienteId()}/solicitudes-fotos`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(solicitudes.flatMap((s) => s.medios).find((m) => m.id === foto.id)?.estado).toBe(
      "eliminando",
    )

    const reintento = MedioFotoSchema.parse((await retirar(foto.id, "cliente").expect(200)).body)
    expect(reintento).toMatchObject({ id: foto.id, estado: "eliminado" })
    expect((await fila(foto.id))!.eliminadoEn).not.toBeNull()
    expect(await almacen().leer(objeto)).toBeNull()
  })

  it("el cliente solo retira lo que aportó; el entrenador, cualquiera de su cliente; el nutricionista, ninguna", async () => {
    const deVisita = await fotoDeVisita()
    // Sin publicar, el cliente ni siquiera la ve.
    await retirar(deVisita.id, "cliente").expect(404)
    // Simula que la visita ya se publicó: la ve, pero no es suya.
    await entorno.prisma.medioFoto.update({
      where: { id: deVisita.id },
      data: { publicadaEn: new Date() },
    })
    await retirar(deVisita.id, "cliente").expect(403)

    const ajena = await aportacion("otro", entorno.ids.otro!, solicitudOtroId)
    await retirar(ajena.id, "cliente").expect(404)
    const propia = await aportacion()
    await retirar(propia.id, "otro").expect(404)
    for (const rol of ["nutricionista", "empleado"]) await retirar(propia.id, rol).expect(403)

    for (const id of [deVisita.id, ajena.id, propia.id])
      expect((await fila(id))!.estado).toBe("disponible")
    await acceso(deVisita.id, "cliente").expect(200)
    await acceso(propia.id, "cliente").expect(200)

    // El entrenador responsable también retira una aportación del cliente.
    expect(
      MedioFotoSchema.parse((await retirar(propia.id, "entrenador").expect(200)).body).estado,
    ).toBe("eliminado")
    await acceso(propia.id, "cliente").expect(404)
    await retirar(randomUUID(), "entrenador").expect(404)
    await retirar("no-es-un-id", "entrenador").expect(400)
  })

  it("la limpieza borra solo intenciones abandonadas, sin tocar fotos, visitas ni solicitudes", async () => {
    const prisma = entorno.prisma
    const ahora = Date.now()
    const hace = (minutos: number) => new Date(ahora - minutos * 60_000)
    const caducar = (id: string, minutos: number) =>
      prisma.medioFoto.update({ where: { id }, data: { subidaCaducaEn: hace(minutos) } })

    // Abandonadas hace más de una hora: una de la visita con el objeto ya
    // subido y otra de la solicitud que nunca llegó a subirse.
    const deVisita = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    await subir(deVisita.subida!)
    await caducar(deVisita.medio.id, 120)
    const deSolicitud = await intencion("cliente", clienteId(), { tipo: "solicitud", solicitudId })
    await caducar(deSolicitud.medio.id, 90)
    // Caducada hace poco (aún dentro del margen) y otra recién pedida.
    const enMargen = await intencion("entrenador", clienteId(), {
      tipo: "valoracion",
      valoracionId,
    })
    await caducar(enMargen.medio.id, 30)
    const vigente = await intencion("cliente", clienteId(), { tipo: "solicitud", solicitudId })
    // Confirmadas o retiradas: aunque su enlace caducara hace mucho, no se tocan.
    const vinculada = await fotoDeVisita()
    const disponible = await aportacion()
    const retirada = await aportacion()
    await retirar(retirada.id, "cliente").expect(200)
    for (const id of [vinculada.id, disponible.id, retirada.id]) await caducar(id, 24 * 60)

    const objetoAbandonado = await clave(deVisita.medio.id)
    const objetoSinLlegar = await clave(deSolicitud.medio.id)
    const objetos = [await clave(vinculada.id), await clave(disponible.id)]
    expect(await almacen().leer(objetoAbandonado)).not.toBeNull()
    const solicitudAntes = await prisma.solicitudFotos.findUniqueOrThrow({
      where: { id: solicitudId },
    })

    const fechaFutura = new Date(ahora + 20 * 60_000)
    const limite = new Date(fechaFutura.getTime() - 60 * 60_000)
    const abandonadas = () =>
      prisma.medioFoto.count({ where: { estado: "pendiente", subidaCaducaEn: { lt: limite } } })
    const limpieza = entorno.app.get(LimpiezaMedios)

    // Si el almacén falla con una, esa sigue pendiente para el siguiente pase.
    const borrarDeVerdad = almacen().borrar.bind(almacen())
    const espia = jest.spyOn(almacen(), "borrar").mockImplementation(async (objeto: string) => {
      if (objeto === objetoSinLlegar) throw new Error("almacén sin conexión (simulado)")
      return borrarDeVerdad(objeto)
    })
    const esperadas = await abandonadas()
    expect(esperadas).toBeGreaterThanOrEqual(2)
    try {
      expect(await limpieza.limpiar(fechaFutura)).toBe(esperadas - 1)
    } finally {
      espia.mockRestore()
    }
    expect(await fila(deVisita.medio.id)).toBeNull()
    expect(await almacen().leer(objetoAbandonado)).toBeNull()
    expect(await fila(deSolicitud.medio.id)).toMatchObject({ estado: "pendiente" })

    const restantes = await abandonadas()
    expect(restantes).toBeGreaterThanOrEqual(1)
    expect(await limpieza.limpiar(fechaFutura)).toBe(restantes)
    expect(await fila(deSolicitud.medio.id)).toBeNull()
    expect(await limpieza.limpiar(fechaFutura)).toBe(0)

    // Lo que no estaba abandonado sigue igual.
    expect((await fila(enMargen.medio.id))!.estado).toBe("pendiente")
    expect((await fila(vigente.medio.id))!.estado).toBe("pendiente")
    expect(await fila(vinculada.id)).toMatchObject({ estado: "disponible", valoracionId })
    expect((await fila(disponible.id))!.estado).toBe("disponible")
    expect((await fila(retirada.id))!.estado).toBe("eliminado")
    for (const objeto of objetos) expect(await almacen().leer(objeto)).not.toBeNull()
    await acceso(vinculada.id, "entrenador").expect(200)
    await acceso(disponible.id, "cliente").expect(200)

    // Limpiar una subida no borra la visita ni la solicitud, ni cambia su estado.
    expect(await prisma.valoracion.findUnique({ where: { id: valoracionId } })).not.toBeNull()
    expect(await prisma.solicitudFotos.findUniqueOrThrow({ where: { id: solicitudId } })).toEqual(
      solicitudAntes,
    )
  })

  /** Deja una intención con el enlace caducado hace dos horas: ya limpiable. */
  const caducadaHaceDosHoras = (id: string) =>
    entorno.prisma.medioFoto.update({
      where: { id },
      data: { subidaCaducaEn: new Date(Date.now() - 2 * 60 * 60_000) },
    })

  it("reintentar una intención caducada la renueva: la limpieza la respeta y la subida se completa", async () => {
    const operacionId = randomUUID()
    const destino: DestinoMedio = { tipo: "solicitud", solicitudId }
    const primera = await intencion("cliente", clienteId(), destino, operacionId)
    await caducadaHaceDosHoras(primera.medio.id)

    // La app reintenta con la misma operación: mismo medio y enlace nuevo.
    const reintento = await intencion("cliente", clienteId(), destino, operacionId)
    expect(reintento.medio.id).toBe(primera.medio.id)
    expect(reintento.subida).not.toBeNull()
    // La base guarda la misma caducidad que el enlace que se acaba de dar.
    const renovada = await fila(primera.medio.id)
    expect(renovada!.subidaCaducaEn.toISOString()).toBe(reintento.subida!.caducaEn)
    expect(renovada!.subidaCaducaEn.getTime()).toBeGreaterThan(Date.now())

    await entorno.app.get(LimpiezaMedios).limpiar(new Date())
    expect(await fila(primera.medio.id)).toMatchObject({ estado: "pendiente" })

    await subir(reintento.subida!)
    expect((await confirmar(primera.medio.id, "cliente")).estado).toBe("disponible")
    await acceso(primera.medio.id, "cliente").expect(200)
  })

  it("una confirmación tardía que la limpieza ya podría descartar no la da por buena", async () => {
    const operacionId = randomUUID()
    const destino: DestinoMedio = { tipo: "solicitud", solicitudId }
    const primera = await intencion("cliente", clienteId(), destino, operacionId)
    await subir(primera.subida!)
    const objeto = await clave(primera.medio.id)
    await caducadaHaceDosHoras(primera.medio.id)

    const respuesta = await request(http())
      .post(`/medios/${primera.medio.id}/confirmacion`)
      .set(entorno.como("cliente"))
      .expect(409)
    expect(respuesta.body).toMatchObject({ message: "La subida ha caducado: vuelve a subirla" })
    // Ni queda disponible ni deja el objeto reescrito para una limpieza simultánea.
    expect(await fila(primera.medio.id)).toMatchObject({ estado: "pendiente" })
    expect(await almacen().leer(objeto)).toBeNull()

    // La misma operación la renueva y la subida se completa.
    const reintento = await intencion("cliente", clienteId(), destino, operacionId)
    expect(reintento.medio.id).toBe(primera.medio.id)
    await subir(reintento.subida!)
    expect((await confirmar(primera.medio.id, "cliente")).estado).toBe("disponible")
  })

  it("si el reintento llega mientras la limpieza la borra, la intención renovada se conserva", async () => {
    const operacionId = randomUUID()
    const destino: DestinoMedio = { tipo: "valoracion", valoracionId }
    const primera = await intencion("entrenador", clienteId(), destino, operacionId)
    await caducadaHaceDosHoras(primera.medio.id)
    const objeto = await clave(primera.medio.id)

    // La limpieza ya la dio por abandonada y el reintento entra antes de borrar la fila.
    let reintento: IntencionSubida | undefined
    const borrarDeVerdad = almacen().borrar.bind(almacen())
    const espia = jest.spyOn(almacen(), "borrar").mockImplementation(async (c: string) => {
      if (c === objeto && !reintento)
        reintento = await intencion("entrenador", clienteId(), destino, operacionId)
      return borrarDeVerdad(c)
    })
    try {
      await entorno.app.get(LimpiezaMedios).limpiar(new Date())
    } finally {
      espia.mockRestore()
    }
    expect(reintento?.medio.id).toBe(primera.medio.id)
    expect(await fila(primera.medio.id)).toMatchObject({ estado: "pendiente" })

    await subir(reintento!.subida!)
    expect((await confirmar(primera.medio.id, "entrenador")).estado).toBe("disponible")
  })

  it("si la limpieza se la lleva justo antes del reintento, este abre una intención nueva", async () => {
    const operacionId = randomUUID()
    const destino: DestinoMedio = { tipo: "solicitud", solicitudId }
    const primera = await intencion("cliente", clienteId(), destino, operacionId)
    await caducadaHaceDosHoras(primera.medio.id)

    // Entre leer la intención y renovarla, la limpieza la borra.
    const medios = entorno.prisma.medioFoto
    const renovarDeVerdad = medios.updateMany.bind(medios)
    let limpiada = false
    const espia = jest.spyOn(medios, "updateMany").mockImplementationOnce((async (
      argumentos: Parameters<typeof renovarDeVerdad>[0],
    ) => {
      await entorno.prisma.medioFoto.delete({ where: { id: primera.medio.id } })
      limpiada = true
      return renovarDeVerdad(argumentos)
    }) as never)
    let reintento: IntencionSubida
    try {
      reintento = await intencion("cliente", clienteId(), destino, operacionId)
    } finally {
      espia.mockRestore()
    }
    expect(limpiada).toBe(true)
    expect(reintento.medio.id).not.toBe(primera.medio.id)
    expect(reintento.medio.estado).toBe("pendiente")
    expect(await fila(primera.medio.id)).toBeNull()

    await subir(reintento.subida!)
    expect((await confirmar(reintento.medio.id, "cliente")).estado).toBe("disponible")
  })

  it("el listado del cliente reúne sus fotos según quién pregunta, sin las pendientes", async () => {
    const delEntrenador = await fotoDeVisita()
    const delCliente = await aportacion()
    const pendiente = (await intencion("cliente", clienteId(), { tipo: "solicitud", solicitudId }))
      .medio
    const listado = async (rol: string) =>
      ListadoFotosSchema.parse(
        (
          await request(http())
            .get(`/seguimiento/clientes/${clienteId()}/fotos`)
            .set(entorno.como(rol))
            .expect(200)
        ).body,
      ).fotos.map((foto) => foto.id)

    const vistasPorEntrenador = await listado("entrenador")
    expect(vistasPorEntrenador).toEqual(expect.arrayContaining([delEntrenador.id, delCliente.id]))
    expect(vistasPorEntrenador).not.toContain(pendiente.id)
    // El cliente no ve una foto del entrenador hasta que se publica la visita.
    const vistasPorCliente = await listado("cliente")
    expect(vistasPorCliente).toContain(delCliente.id)
    expect(vistasPorCliente).not.toContain(delEntrenador.id)
    expect(vistasPorCliente).not.toContain(pendiente.id)
    await entorno.prisma.medioFoto.update({
      where: { id: delEntrenador.id },
      data: { publicadaEn: new Date() },
    })
    expect(await listado("cliente")).toContain(delEntrenador.id)

    for (const rol of ["nutricionista", "otro", "empleado"])
      await request(http())
        .get(`/seguimiento/clientes/${clienteId()}/fotos`)
        .set(entorno.como(rol))
        .expect(403)
  })

  it("la limpieza se programa según MEDIOS_LIMPIEZA_MINUTOS, nunca en pruebas, y se detiene al cerrar", () => {
    const antes = {
      NODE_ENV: process.env.NODE_ENV,
      MEDIOS_LIMPIEZA_MINUTOS: process.env.MEDIOS_LIMPIEZA_MINUTOS,
    }
    const programar = jest.spyOn(globalThis, "setInterval")
    const detener = jest.spyOn(globalThis, "clearInterval")
    const nueva = () => new LimpiezaMedios(entorno.prisma, almacen())
    let limpieza: LimpiezaMedios | undefined
    try {
      process.env.NODE_ENV = "test"
      delete process.env.MEDIOS_LIMPIEZA_MINUTOS
      nueva().onApplicationBootstrap()
      expect(programar).not.toHaveBeenCalled()

      process.env.NODE_ENV = "production"
      process.env.MEDIOS_LIMPIEZA_MINUTOS = "0"
      nueva().onApplicationBootstrap()
      expect(programar).not.toHaveBeenCalled()
      process.env.MEDIOS_LIMPIEZA_MINUTOS = "cada hora"
      expect(() => nueva().onApplicationBootstrap()).toThrow(/MEDIOS_LIMPIEZA_MINUTOS/)
      process.env.MEDIOS_LIMPIEZA_MINUTOS = "0.000001"
      expect(() => nueva().onApplicationBootstrap()).toThrow(/MEDIOS_LIMPIEZA_MINUTOS/)
      expect(programar).not.toHaveBeenCalled()

      delete process.env.MEDIOS_LIMPIEZA_MINUTOS
      limpieza = nueva()
      limpieza.onApplicationBootstrap()
      expect(programar).toHaveBeenCalledTimes(1)
      expect(programar.mock.calls[0]![1]).toBe(60 * 60_000)
      const temporizador = programar.mock.results[0]!.value as NodeJS.Timeout
      // No mantiene vivo el proceso por sí solo.
      expect(temporizador.hasRef()).toBe(false)
      limpieza.onApplicationShutdown()
      expect(detener).toHaveBeenCalledWith(temporizador)
    } finally {
      limpieza?.onApplicationShutdown()
      programar.mockRestore()
      detener.mockRestore()
      for (const [nombre, valor] of Object.entries(antes))
        if (valor === undefined) delete process.env[nombre]
        else process.env[nombre] = valor
    }
  })
})
