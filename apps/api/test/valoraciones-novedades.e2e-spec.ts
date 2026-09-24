import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  IntencionSubidaSchema,
  ListadoAvisosSeguimientoSchema,
  ListadoSolicitudesFotosSchema,
  PublicacionValoracionSchema,
  SolicitudFotosSchema,
  ValoracionClienteSchema,
  ValoracionProfesionalSchema,
  type DefinicionCorporal,
  type ListadoAvisosSeguimiento,
  type PublicacionValoracion,
  type SolicitudFotos,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"

// Datos e imágenes sintéticos, en la base y el almacén desechables de pruebas.
const NOMBRE = "valoraciones-novedades"
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

describe("Avisos de seguimiento con lectura por usuario (E02a)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const jpeg = jpegSintetico()
  beforeAll(async () => {
    entorno = await entornoEntrenamiento(NOMBRE)
    await request(http())
      .put(ruta("plantilla-valoracion"))
      .set(como("entrenador"))
      .send({ revision: 0, corporales: [peso], pruebas: [] })
      .expect(200)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => entorno.app.getHttpServer()
  const como = (rol: string) => entorno.como(rol)
  const ruta = (resto: string, clienteId = entorno.ids.cliente!) =>
    `/seguimiento/clientes/${clienteId}/${resto}`

  async function avisos(
    rol = "cliente",
    clienteId = entorno.ids.cliente!,
    cabecera = como(rol),
  ): Promise<ListadoAvisosSeguimiento> {
    const listado = ListadoAvisosSeguimientoSchema.parse(
      (await request(http()).get(ruta("avisos", clienteId)).set(cabecera).expect(200)).body,
    )
    // «Sin leer» cuenta solo lo vigente que ese usuario aún no ha leído.
    expect(listado.sinLeer).toBe(
      listado.avisos.filter((a) => a.vigente && a.leidoEn === null).length,
    )
    return listado
  }
  const leer = (avisoIds: string[], rol = "cliente", clienteId = entorno.ids.cliente!) =>
    request(http()).post(ruta("avisos/leidos", clienteId)).set(como(rol)).send({ avisoIds })
  const buscar = (listado: ListadoAvisosSeguimiento, id: string) =>
    listado.avisos.find((a) => a.id === id)
  const codigo = (respuesta: { body: unknown }) => ErrorDeApiSchema.parse(respuesta.body).codigo

  async function visitaPublicada(): Promise<{ visitaId: string; primera: PublicacionValoracion }> {
    const creada = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .post(ruta("valoraciones"))
          .set(como("entrenador"))
          .send({
            operacionId: randomUUID(),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: ["medidas"],
          })
          .expect(201)
      ).body,
    )
    const guardada = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .put(ruta(`valoraciones/${creada.id}`))
          .set(como("entrenador"))
          .send({
            borradorId: creada.borrador!.id,
            revision: creada.borrador!.revision,
            fechaToma: "2026-09-24",
            contenido: {
              bloques: ["medidas"],
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
    const primera = PublicacionValoracionSchema.parse(
      (
        await request(http())
          .post(ruta(`valoraciones/${guardada.id}/publicaciones`))
          .set(como("entrenador"))
          .send({
            operacionId: randomUUID(),
            borradorId: guardada.borrador!.id,
            revision: guardada.borrador!.revision,
            sustituyePublicacionId: null,
          })
          .expect(201)
      ).body,
    )
    return { visitaId: guardada.id, primera }
  }

  async function corregir(
    visitaId: string,
    vigente: PublicacionValoracion,
  ): Promise<PublicacionValoracion> {
    const correccion = ValoracionProfesionalSchema.parse(
      (
        await request(http())
          .post(ruta("valoraciones"))
          .set(como("entrenador"))
          .send({ operacionId: randomUUID(), corrigePublicacionId: vigente.id })
          .expect(201)
      ).body,
    )
    expect(correccion.id).toBe(visitaId)
    return PublicacionValoracionSchema.parse(
      (
        await request(http())
          .post(ruta(`valoraciones/${visitaId}/publicaciones`))
          .set(como("entrenador"))
          .send({
            operacionId: randomUUID(),
            borradorId: correccion.borrador!.id,
            revision: correccion.borrador!.revision,
            sustituyePublicacionId: vigente.id,
          })
          .expect(201)
      ).body,
    )
  }

  async function pedirFotos(operacionId = randomUUID()): Promise<SolicitudFotos> {
    return SolicitudFotosSchema.parse(
      (
        await request(http())
          .post(ruta("solicitudes-fotos"))
          .set(como("entrenador"))
          .send({
            operacionId,
            vistas: ["frente"],
            fechaLimite: null,
            mensaje: null,
          })
          .expect(201)
      ).body,
    )
  }

  async function aportar(solicitudId: string): Promise<void> {
    const { medio, subida } = IntencionSubidaSchema.parse(
      (
        await request(http())
          .post("/medios/subidas")
          .set(como("cliente"))
          .send({
            operacionId: randomUUID(),
            clienteId: entorno.ids.cliente!,
            destino: { tipo: "solicitud", solicitudId },
            vista: "frente",
            etiqueta: null,
            fechaToma: "2026-09-25",
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
    await request(http()).post(`/medios/${medio.id}/confirmacion`).set(como("cliente")).expect(200)
  }

  async function solicitud(id: string, rol = "cliente"): Promise<SolicitudFotos | undefined> {
    return ListadoSolicitudesFotosSchema.parse(
      (await request(http()).get(ruta("solicitudes-fotos")).set(como(rol)).expect(200)).body,
    ).solicitudes.find((s) => s.id === id)
  }

  it("el cliente ve su valoración publicada y, al corregirla, la original deja de ser vigente", async () => {
    const { ids } = entorno
    const { visitaId, primera } = await visitaPublicada()
    const antes = await avisos()
    expect(buscar(antes, primera.id)).toEqual({
      id: primera.id,
      tipo: "valoracionPublicada",
      clienteId: ids.cliente!,
      autor: { id: ids.entrenador!, nombre: "entrenador" },
      creadoEn: primera.publicadaEn,
      destino: { tipo: "valoracion", valoracionId: visitaId },
      vigente: true,
      leidoEn: null,
    })
    expect(antes.sinLeer).toBe(1)
    // El entrenador no recibe aviso de lo que él mismo publica.
    expect((await avisos("entrenador")).avisos).toEqual([])

    const segunda = await corregir(visitaId, primera)
    const despues = await avisos()
    expect(despues.avisos.map((a) => a.id)).toEqual([segunda.id, primera.id])
    expect(buscar(despues, segunda.id)).toMatchObject({
      tipo: "valoracionCorregida",
      creadoEn: segunda.publicadaEn,
      destino: { tipo: "valoracion", valoracionId: visitaId },
      vigente: true,
      leidoEn: null,
    })
    expect(buscar(despues, primera.id)).toMatchObject({
      tipo: "valoracionPublicada",
      vigente: false,
      leidoEn: null,
    })
    expect(despues.sinLeer).toBe(1)
    // El destino abre la versión vigente de la visita.
    const destino = ValoracionClienteSchema.parse(
      (
        await request(http())
          .get(ruta(`valoraciones/${visitaId}`))
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(destino.publicacion.id).toBe(segunda.id)
  })

  it("el cliente ve la solicitud pendiente; leerla dos veces no duplica ni cambia la solicitud", async () => {
    const { ids, prisma } = entorno
    const operacionId = randomUUID()
    const pedida = await pedirFotos(operacionId)
    // Un reintento de la misma operación no crea otro aviso.
    expect((await pedirFotos(operacionId)).id).toBe(pedida.id)
    const listado = await avisos()
    expect(listado.avisos.filter((a) => a.id === pedida.id)).toHaveLength(1)
    expect(listado.avisos[0]).toEqual({
      id: pedida.id,
      tipo: "fotosSolicitadas",
      clienteId: ids.cliente!,
      autor: { id: ids.entrenador!, nombre: "entrenador" },
      creadoEn: pedida.creadaEn,
      destino: { tipo: "solicitud", solicitudId: pedida.id },
      vigente: true,
      leidoEn: null,
    })

    const leido = ListadoAvisosSeguimientoSchema.parse((await leer([pedida.id]).expect(200)).body)
    const leidoEn = buscar(leido, pedida.id)!.leidoEn
    expect(leidoEn).not.toBeNull()
    expect(leido.sinLeer).toBe(listado.sinLeer - 1)
    const repetido = ListadoAvisosSeguimientoSchema.parse(
      (await leer([pedida.id]).expect(200)).body,
    )
    expect(buscar(repetido, pedida.id)!.leidoEn).toBe(leidoEn)
    expect(repetido.sinLeer).toBe(leido.sinLeer)
    expect(await prisma.lecturaAvisoSeguimiento.count({ where: { avisoId: pedida.id } })).toBe(1)

    // Leer el aviso no toca la solicitud.
    expect(await solicitud(pedida.id)).toEqual(pedida)

    // Otro dispositivo del mismo cliente (otra sesión) comparte la lectura.
    const login = await request(http())
      .post("/auth/login")
      .send({
        email: `cliente@e2e-entrenamiento-${NOMBRE}.test`,
        contrasena: "Prueba-entrenamiento-2026!",
      })
      .expect(200)
    const otroDispositivo = await avisos("cliente", ids.cliente!, {
      Authorization: `Bearer ${login.body.tokenAcceso as string}`,
    })
    expect(buscar(otroDispositivo, pedida.id)!.leidoEn).toBe(leidoEn)
  })

  it("el entrenador ve las fotos recibidas; leer no las revisa y al revisarlas deja de ser vigente", async () => {
    const { ids, prisma } = entorno
    const pedida = await pedirFotos()
    expect(buscar(await avisos("entrenador"), pedida.id)).toBeUndefined()
    await leer([pedida.id]).expect(200)

    await aportar(pedida.id)
    const recibida = (await solicitud(pedida.id, "entrenador"))!
    expect(recibida.estado).toBe("recibida")
    expect(buscar(await avisos(), pedida.id)).toMatchObject({
      tipo: "fotosSolicitadas",
      vigente: false,
    })

    // La lectura del cliente no cuenta para el entrenador.
    const entrenador = await avisos("entrenador")
    expect(entrenador.avisos).toEqual([
      {
        id: pedida.id,
        tipo: "fotosRecibidas",
        clienteId: ids.cliente!,
        autor: { id: ids.cliente!, nombre: "cliente" },
        creadoEn: recibida.recibidaEn,
        destino: { tipo: "solicitud", solicitudId: pedida.id },
        vigente: true,
        leidoEn: null,
      },
    ])
    expect(entrenador.sinLeer).toBe(1)

    const leido = ListadoAvisosSeguimientoSchema.parse(
      (await leer([pedida.id], "entrenador").expect(200)).body,
    )
    expect(buscar(leido, pedida.id)!.leidoEn).not.toBeNull()
    expect(leido.sinLeer).toBe(0)
    // Leer no es revisar: la solicitud y sus fotos siguen como estaban.
    expect(await solicitud(pedida.id, "entrenador")).toEqual(recibida)
    expect(
      await prisma.lecturaAvisoSeguimiento.count({
        where: { avisoId: pedida.id, usuarioId: { in: [ids.cliente!, ids.entrenador!] } },
      }),
    ).toBe(2)

    await request(http())
      .post(ruta(`solicitudes-fotos/${pedida.id}/revision`))
      .set(como("entrenador"))
      .send({ operacionId: randomUUID() })
      .expect(200)
    expect(buscar(await avisos("entrenador"), pedida.id)).toMatchObject({
      tipo: "fotosRecibidas",
      vigente: false,
    })
  })

  it("solo se marcan avisos que el usuario ve; si alguno no lo es, no se marca ninguno", async () => {
    const { ids, prisma } = entorno
    const { primera } = await visitaPublicada()
    const ajena = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
      },
    })
    expect(codigo(await leer([primera.id, randomUUID()]).expect(400))).toBe("solicitud_invalida")
    expect(codigo(await leer([primera.id, ajena.id]).expect(400))).toBe("solicitud_invalida")
    // El entrenador no tiene avisos de publicaciones.
    expect(codigo(await leer([primera.id], "entrenador").expect(400))).toBe("solicitud_invalida")
    expect(codigo(await leer([]).expect(400))).toBe("solicitud_invalida")
    expect(codigo(await leer([primera.id, primera.id]).expect(400))).toBe("solicitud_invalida")
    expect(buscar(await avisos(), primera.id)!.leidoEn).toBeNull()
    expect(
      await prisma.lecturaAvisoSeguimiento.count({
        where: { avisoId: { in: [primera.id, ajena.id] } },
      }),
    ).toBe(0)

    // El otro cliente solo ve lo suyo.
    expect((await avisos("otro", ids.otro!)).avisos.map((a) => a.id)).toEqual([ajena.id])
  })

  it("devuelve como mucho 50, los más recientes primero, y no marca los que quedan fuera", async () => {
    const { ids, prisma } = entorno
    const base = Date.parse("2026-01-01T08:00:00.000Z")
    const filas = Array.from({ length: 51 }, (_, i) => ({
      id: randomUUID(),
      clienteId: ids.otro!,
      autorId: ids.entrenador!,
      operacionId: randomUUID(),
      vistas: ["frente" as const],
      creadaEn: new Date(base + i * 60_000),
    }))
    await prisma.solicitudFotos.createMany({ data: filas })
    const listado = await avisos("otro", ids.otro!)
    expect(listado.avisos).toHaveLength(50)
    const fechas = listado.avisos.map((a) => a.creadoEn)
    expect(fechas).toEqual([...fechas].sort().reverse())
    expect(buscar(listado, filas[50]!.id)).toBeDefined()
    expect(buscar(listado, filas[0]!.id)).toBeUndefined()
    expect(codigo(await leer([filas[0]!.id], "otro", ids.otro!).expect(400))).toBe(
      "solicitud_invalida",
    )
  })

  it("otro cliente, el nutricionista (aunque esté asignado) y el empleado reciben 403", async () => {
    const { ids, prisma } = entorno
    const comprobar = async (rol: string) => {
      await request(http()).get(ruta("avisos")).set(como(rol)).expect(403)
      await leer([randomUUID()], rol).expect(403)
    }
    for (const rol of ["otro", "nutricionista", "empleado"]) await comprobar(rol)
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
    })
    try {
      await comprobar("nutricionista")
    } finally {
      await prisma.asignacionNutricionista.deleteMany({
        where: { nutricionistaId: ids.nutricionista! },
      })
    }
    await request(http()).get(ruta("avisos", randomUUID())).set(como("entrenador")).expect(404)
  })
})
