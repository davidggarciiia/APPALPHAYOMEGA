import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import { SesionesService } from "../src/entrenamiento/sesiones.service.js"
import { ConsentimientoService } from "../src/identity/consentimiento.service.js"
import request from "supertest"
import {
  BorradorSchema,
  ListadoAnterioresSchema,
  PlanAsignadoSchema,
  ResultadoEntrenamientoSchema,
  type GuardarBorrador,
  VERSION_CONSENTIMIENTO,
  ErrorDeApiSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { esperarPausa } from "./concurrencia-ayuda.js"

describe("Borrador privado y envío atómico", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("registro")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  async function preparar() {
    const datos = entorno.plan()
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
      .expect(201)
    const id = PlanAsignadoSchema.parse(respuesta.body).sesiones[0]!.agenda.id
    const series = datos.patron.sesiones[0]!.ejercicios[0]!.series
    const borrador: GuardarBorrador = {
      operacionId: randomUUID(),
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro: {
        notas: "Nota privada",
        series: [
          {
            serieId: series[0]!.id,
            tipoMedicion: "repeticiones",
            pesoKg: 22.5,
            repeticiones: 8,
            hecha: true,
          },
          {
            serieId: series[1]!.id,
            tipoMedicion: "tiempo",
            pesoKg: null,
            segundos: 99,
            hecha: false,
          },
        ],
      },
    }
    return { id, borrador, base: `/entrenamiento/sesiones/${id}` }
  }
  it("lleva la prescripción del diseño hasta el resultado: partes, RIR, check-in y cierre", async () => {
    const { app, como } = entorno
    const datos = entorno.plan()
    const sesion = datos.patron.sesiones[0]!
    const ejercicio = sesion.ejercicios[0]!
    const primera = ejercicio.series[0]!
    Object.assign(sesion, {
      duracion: "100–115 min",
      nota: "Banca: 60 kg de inicio para 4×6",
      partes: { calentamiento: "8–10", fuerza: "70–85", cardio: "15", calma: "5" },
    })
    Object.assign(ejercicio, {
      seccion: "principal",
      rir: { min: 2, max: 3 },
      descanso: "2–3 min",
      subidaKg: 2.5,
      alternativas: ["Press en multipower"],
      compuesto: true,
    })
    if (primera.tipoMedicion === "repeticiones") Object.assign(primera, { repeticionesMax: 12 })
    const asignado = await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(datos)
      .expect(201)
    const id = PlanAsignadoSchema.parse(asignado.body).sesiones[0]!.agenda.id
    const base = `/entrenamiento/sesiones/${id}`
    const leida = await request(app.getHttpServer()).get(base).set(como("cliente")).expect(200)
    expect(leida.body.prescripcion).toMatchObject({
      duracion: "100–115 min",
      partes: { fuerza: "70–85" },
      ejercicios: [{ rir: { min: 2, max: 3 }, descanso: "2–3 min", subidaKg: 2.5 }],
    })
    expect(leida.body.prescripcion.ejercicios[0].series[0].repeticionesMax).toBe(12)

    const inicio = new Date().toISOString()
    const registro = {
      notas: null,
      checkin: { sensacion: 4, molestia: "agujetas" as const },
      inicio,
      series: [
        {
          serieId: primera.id,
          tipoMedicion: "repeticiones" as const,
          pesoKg: 20,
          repeticiones: 10,
          rir: 2,
          hecha: true,
        },
      ],
    }
    await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send({ operacionId: randomUUID(), revisionPrescripcion: 0, revisionBorrador: 0, registro })
      .expect(200)
    const enviado = await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 1,
        registro: { ...registro, cierre: { esfuerzo: 7, energia: 3, incomodo: false } },
      })
      .expect(200)
    const resultado = ResultadoEntrenamientoSchema.parse(enviado.body)
    expect(resultado).toMatchObject({
      checkin: { sensacion: 4, molestia: "agujetas" },
      cierre: { esfuerzo: 7, energia: 3, incomodo: false },
      inicio,
    })
    expect(resultado.series[0]).toMatchObject({ hecha: true, valores: { rir: 2 } })

    const rango = entorno.plan()
    const serieMala = rango.patron.sesiones[0]!.ejercicios[0]!.series[0]!
    if (serieMala.tipoMedicion === "repeticiones") Object.assign(serieMala, { repeticionesMax: 1 })
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(rango)
      .expect(400)
  })

  it("da la mejor serie de la última vez de cada ejercicio, solo a quien ve la sesión", async () => {
    const { app, como } = entorno
    const primera = await preparar()
    const series = primera.borrador.registro.series
    await request(app.getHttpServer())
      .post(`${primera.base}/enviar`)
      .set(como("cliente"))
      .send({
        ...primera.borrador,
        registro: {
          ...primera.borrador.registro,
          series: [
            { ...series[0]!, pesoKg: 25, repeticiones: 6 },
            { ...series[1]!, hecha: true, segundos: 40 },
          ],
        },
      })
      .expect(200)
    const segunda = await preparar()
    const respuesta = await request(app.getHttpServer())
      .get(`${segunda.base}/anteriores`)
      .set(como("cliente"))
      .expect(200)
    const anteriores = ListadoAnterioresSchema.parse(respuesta.body).anteriores
    expect(anteriores).toHaveLength(1)
    expect(anteriores[0]).toMatchObject({
      ejercicioId: entorno.ids.ejercicio,
      valores: { tipoMedicion: "repeticiones", pesoKg: 25, repeticiones: 6 },
    })
    await request(app.getHttpServer())
      .get(`${segunda.base}/anteriores`)
      .set(como("entrenador"))
      .expect(200)
    await request(app.getHttpServer())
      .get(`${segunda.base}/anteriores`)
      .set(como("otro"))
      .expect(404)
    await request(app.getHttpServer())
      .get(`${segunda.base}/anteriores`)
      .set(como("nutricionista"))
      .expect(403)
  })

  it("sincroniza solo para el propietario sin filtrar valores al entrenador", async () => {
    const { base, borrador } = await preparar()
    const { app, como } = entorno
    const guardado = await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
    expect(BorradorSchema.parse(guardado.body).revision).toBe(1)
    const repetido = await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
    expect(repetido.body).toEqual(guardado.body)
    const privado = await request(app.getHttpServer())
      .get(`${base}/borrador`)
      .set(como("cliente"))
      .expect(200)
    expect(privado.body.registro.notas).toBe("Nota privada")
    const publico = await request(app.getHttpServer()).get(base).set(como("entrenador")).expect(200)
    expect(publico.body).not.toHaveProperty("borrador")
    expect(JSON.stringify(publico.body)).not.toContain("Nota privada")
    for (const rol of ["entrenador", "nutricionista", "empleado"]) {
      await request(app.getHttpServer()).get(`${base}/borrador`).set(como(rol)).expect(403)
      await request(app.getHttpServer())
        .put(`${base}/borrador`)
        .set(como(rol))
        .send(borrador)
        .expect(403)
    }
    await request(app.getHttpServer()).get(`${base}/borrador`).set(como("otro")).expect(404)
    await request(app.getHttpServer()).get(`${base}/resultado`).set(como("entrenador")).expect(404)
  })
  it("dos dispositivos no se pisan y una operación no acepta un cuerpo distinto", async () => {
    const { base, borrador } = await preparar()
    const { app, como } = entorno
    const guardar = (datos: GuardarBorrador) =>
      request(app.getHttpServer()).put(`${base}/borrador`).set(como("cliente")).send(datos)
    const respuestas = await Promise.all([
      guardar(borrador),
      guardar({ ...borrador, operacionId: randomUUID() }),
    ])
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409])
    const ganadora = respuestas[0]!.status === 200 ? borrador : null
    if (ganadora)
      await guardar({ ...ganadora, registro: { ...borrador.registro, notas: "Otra nota" } }).expect(
        409,
      )
    await guardar({
      ...borrador,
      operacionId: randomUUID(),
      revisionBorrador: 1,
      registro: {
        notas: null,
        series: [{ ...borrador.registro.series[0]!, serieId: randomUUID() }],
      },
    }).expect(400)
  })
  it("envía una sola vez, cierra la agenda y elimina los valores de series omitidas", async () => {
    const { base, borrador, id } = await preparar()
    const { app, como, prisma } = entorno
    await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
    const envio = {
      ...borrador,
      operacionId: randomUUID(),
      revisionBorrador: 1,
      registro: {
        ...borrador.registro,
        tiempoActivoSegundos: 125,
        series: [
          borrador.registro.series[0]!,
          { ...borrador.registro.series[1]!, omitida: true as const },
        ],
      },
    }
    const enviar = () =>
      request(app.getHttpServer()).post(`${base}/enviar`).set(como("cliente")).send(envio)
    const [uno, dos] = await Promise.all([enviar(), enviar()])
    expect([uno.status, dos.status]).toEqual([200, 200])
    expect(uno.body).toEqual(dos.body)
    const resultado = ResultadoEntrenamientoSchema.parse(uno.body)
    expect(resultado.series[1]).toEqual({
      serieId: borrador.registro.series[1]!.serieId,
      hecha: false,
      omitida: true,
    })
    expect(resultado.tiempoActivoSegundos).toBe(125)
    const entrenador = await request(app.getHttpServer())
      .get(`${base}/resultado`)
      .set(como("entrenador"))
      .expect(200)
    expect(entrenador.body).toEqual(resultado)
    const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({
      where: { id },
      include: { agenda: true },
    })
    expect(fila.borrador).toBeNull()
    expect(fila.agenda.estado).toBe("cerrada")
    expect(fila.agenda.revision).toBe(1)
    expect(
      await prisma.operacionEntrenamiento.count({ where: { sesionId: id, tipo: "borrador" } }),
    ).toBe(0)
    await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(409)
    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({ ...envio, operacionId: randomUUID() })
      .expect(409)
  })
  it("rechaza envíos vacíos sin cerrar la sesión y deniega al entrenador enviar por el cliente", async () => {
    const { base, borrador, id } = await preparar()
    const { app, como, prisma } = entorno
    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({ ...borrador, registro: { notas: null, series: [] } })
      .expect(400)
    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("entrenador"))
      .send(borrador)
      .expect(403)
    expect((await prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })).estado).toBe(
      "abierta",
    )
  })
  it("molestias simultáneas del mismo UUID devuelven el aviso y rechazan otro contenido", async () => {
    const { base, id } = await preparar()
    const { app, como, prisma, ids } = entorno
    const datos = {
      operacionId: randomUUID(),
      ejercicioPrescritoId: null,
      serie: null,
      zona: "hombro",
      intensidad: 3,
      sintomas: [],
      nota: "Aviso sintético",
    }
    const avisar = (nota = datos.nota) =>
      request(app.getHttpServer())
        .post(`${base}/molestias`)
        .set(como("cliente"))
        .send({ ...datos, nota })
    const respuestas = await Promise.all([avisar(), avisar()])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect(ErrorDeApiSchema.parse((await avisar("Otro aviso").expect(409)).body).codigo).toBe(
      "operacion_incompatible",
    )
    expect(
      await prisma.molestia.count({
        where: { clienteId: ids.cliente!, sesionId: id, operacionId: datos.operacionId },
      }),
    ).toBe(1)
  })

  it("comentarios simultáneos del mismo UUID dejan un comentario y una novedad", async () => {
    const { base, id, borrador } = await preparar()
    const { app, como, prisma, ids } = entorno
    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
    const datos = {
      operacionId: randomUUID(),
      ejercicioPrescritoId: null,
      texto: "Comentario sintético",
    }
    const comentar = () =>
      request(app.getHttpServer()).post(`${base}/comentarios`).set(como("entrenador")).send(datos)
    const respuestas = await Promise.all([comentar(), comentar()])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect(
      await prisma.comentarioSesion.count({
        where: { autorId: ids.entrenador!, operacionId: datos.operacionId },
      }),
    ).toBe(1)
    expect(
      await prisma.novedadEntrenamiento.count({ where: { sesionId: id, tipo: "comentario" } }),
    ).toBe(1)
  })

  it("mover y enviar simultáneamente terminan con una sesión cerrada y sin bloqueo circular", async () => {
    const { base, id, borrador } = await preparar()
    const { app, como, prisma } = entorno
    const [mover, enviar] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/agenda/sesiones/${id}/fecha`)
        .set(como("cliente"))
        .send({ fecha: "2026-09-15", revision: 0 }),
      request(app.getHttpServer()).post(`${base}/enviar`).set(como("cliente")).send(borrador),
    ])
    expect(enviar.status).toBe(200)
    expect([200, 409]).toContain(mover.status)
    const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({
      where: { id },
      include: { agenda: true },
    })
    expect(fila.resultado).not.toBeNull()
    expect(fila.agenda.estado).toBe("cerrada")
  })

  it("una retirada posterior al guard impide crear la molestia y su novedad", async () => {
    const { base, id } = await preparar()
    const { app, como, prisma, ids } = entorno
    const servicio = app.get(ConsentimientoService)
    const original = servicio.exigirVigente.bind(servicio)
    let avisar!: () => void
    let continuar!: () => void
    const dentro = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const pausa = new Promise<void>((resolve) => {
      continuar = resolve
    })
    const espia = jest.spyOn(servicio, "exigirVigente").mockImplementationOnce(async (...args) => {
      avisar()
      await pausa
      return original(...args)
    })
    const operacionId = randomUUID()
    const pendiente = request(app.getHttpServer())
      .post(`${base}/molestias`)
      .set(como("cliente"))
      .send({
        operacionId,
        ejercicioPrescritoId: null,
        serie: null,
        zona: "hombro",
        intensidad: 3,
        sintomas: [],
        nota: null,
      })
      .then((respuesta) => respuesta)
    try {
      await esperarPausa(dentro, pendiente)
      await request(app.getHttpServer()).delete("/consentimiento").set(como("cliente")).expect(200)
      continuar()
      const respuesta = await pendiente
      expect(respuesta.status).toBe(409)
      expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("consentimiento_pendiente")
      expect(await prisma.molestia.count({ where: { clienteId: ids.cliente!, operacionId } })).toBe(
        0,
      )
      expect(
        await prisma.novedadEntrenamiento.count({ where: { sesionId: id, tipo: "molestia" } }),
      ).toBe(0)
    } finally {
      continuar()
      await Promise.allSettled([pendiente])
      espia.mockRestore()
      await request(app.getHttpServer())
        .post("/consentimiento")
        .set(como("cliente"))
        .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
        .expect(201)
    }
  })

  it.each(["borrador", "enviar"])(
    "si la baja gana después del guard, %s no persiste",
    async (accion) => {
      const { base, borrador, id } = await preparar()
      const { app, como, prisma, ids } = entorno
      const sesiones = app.get(SesionesService)
      const original = sesiones.bloquear.bind(sesiones)
      let avisar: () => void = () => undefined
      let continuar: () => void = () => undefined
      const dentro = new Promise<void>((resolve) => {
        avisar = resolve
      })
      const pausa = new Promise<void>((resolve) => {
        continuar = resolve
      })
      const espia = jest.spyOn(sesiones, "bloquear").mockImplementationOnce(async (...args) => {
        const fila = await original(...args)
        avisar()
        await pausa
        return fila
      })
      const peticion = request(app.getHttpServer())
      const pendiente = (
        accion === "borrador" ? peticion.put(`${base}/borrador`) : peticion.post(`${base}/enviar`)
      )
        .set(como("cliente"))
        .send(borrador)
        .then((respuesta) => respuesta)
      try {
        await esperarPausa(dentro, pendiente)
        await prisma.usuario.update({ where: { id: ids.cliente }, data: { estado: "desactivado" } })
        continuar()
        expect((await pendiente).status).toBe(401)
        const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({
          where: { id },
          include: { agenda: true },
        })
        expect(fila.borrador).toBeNull()
        expect(fila.resultado).toBeNull()
        expect(fila.agenda.estado).toBe("abierta")
      } finally {
        continuar()
        await pendiente
        espia.mockRestore()
        await prisma.usuario.update({ where: { id: ids.cliente }, data: { estado: "activo" } })
      }
    },
  )
})
