import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import { SesionesService } from "../src/entrenamiento/sesiones.service.js"
import request from "supertest"
import {
  BorradorSchema,
  PlanAsignadoSchema,
  ResultadoEntrenamientoSchema,
  type GuardarBorrador,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

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
    const envio = { ...borrador, operacionId: randomUUID(), revisionBorrador: 1 }
    const enviar = () =>
      request(app.getHttpServer()).post(`${base}/enviar`).set(como("cliente")).send(envio)
    const [uno, dos] = await Promise.all([enviar(), enviar()])
    expect([uno.status, dos.status]).toEqual([200, 200])
    expect(uno.body).toEqual(dos.body)
    const resultado = ResultadoEntrenamientoSchema.parse(uno.body)
    expect(resultado.series[1]).toEqual({
      serieId: borrador.registro.series[1]!.serieId,
      hecha: false,
    })
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
        await dentro
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
