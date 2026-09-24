import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  DiaDeSeguimientoSchema,
  ErrorDeApiSchema,
  ListadoDiasSchema,
  ListadoMedidasSchema,
  ListadoPruebasSchema,
  MedidaSchema,
  PlanAsignadoSchema,
  ProgresionFuerzaSchema,
  ZONA_AGENDA,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

function dia(desplazamiento: number): string {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())
  const fecha = new Date(`${hoy}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + desplazamiento)
  return fecha.toISOString().slice(0, 10)
}

describe("Seguimiento del cliente", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("seguimiento")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const ruta = (clienteId: string, resto: string) => `/seguimiento/clientes/${clienteId}/${resto}`

  it("el cliente guarda su día por partes y puede borrar un dato", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    const hoy = dia(0)
    const primero = await request(http)
      .put(ruta(ids.cliente!, `dias/${hoy}`))
      .set(como("cliente"))
      .send({ pesoKg: 111.6, pasos: 3240 })
      .expect(200)
    expect(DiaDeSeguimientoSchema.parse(primero.body)).toEqual({
      fecha: hoy,
      pesoKg: 111.6,
      pasos: 3240,
      suenoMin: null,
      creatina: null,
    })
    await request(http)
      .put(ruta(ids.cliente!, `dias/${hoy}`))
      .set(como("cliente"))
      .send({ creatina: true, suenoMin: 460 })
      .expect(200)
    const borrado = await request(http)
      .put(ruta(ids.cliente!, `dias/${hoy}`))
      .set(como("cliente"))
      .send({ pasos: null })
      .expect(200)
    expect(borrado.body).toEqual({
      fecha: hoy,
      pesoKg: 111.6,
      pasos: null,
      suenoMin: 460,
      creatina: true,
    })
  })

  it("rechaza días futuros, otros clientes y a quien no es el cliente", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    ErrorDeApiSchema.parse(
      (
        await request(http)
          .put(ruta(ids.cliente!, `dias/${dia(2)}`))
          .set(como("cliente"))
          .send({ pasos: 100 })
          .expect(400)
      ).body,
    )
    await request(http)
      .put(ruta(ids.otro!, `dias/${dia(0)}`))
      .set(como("cliente"))
      .send({ pasos: 100 })
      .expect(403)
    await request(http)
      .put(ruta(ids.cliente!, `dias/${dia(0)}`))
      .set(como("entrenador"))
      .send({ pasos: 100 })
      .expect(403)
    await request(http)
      .put(ruta(ids.cliente!, `dias/${dia(0)}`))
      .set(como("cliente"))
      .send({})
      .expect(400)
  })

  it("el equipo lee los días; el nutricionista solo con asignación", async () => {
    const { app, como, ids, prisma } = entorno
    const http = app.getHttpServer()
    const periodo = `dias?desde=${dia(-7)}&hasta=${dia(0)}`
    const leidos = await request(http)
      .get(ruta(ids.cliente!, periodo))
      .set(como("entrenador"))
      .expect(200)
    expect(ListadoDiasSchema.parse(leidos.body).dias.map((d) => d.fecha)).toContain(dia(0))
    await request(http).get(ruta(ids.cliente!, periodo)).set(como("nutricionista")).expect(403)
    await prisma.asignacionNutricionista.create({
      data: { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
    })
    await request(http).get(ruta(ids.cliente!, periodo)).set(como("nutricionista")).expect(200)
  })

  it("las medidas son idempotentes y llevan la fecha de nacimiento", async () => {
    const { app, como, ids, prisma } = entorno
    const http = app.getHttpServer()
    await prisma.usuario.update({
      where: { id: ids.cliente! },
      data: { fechaNacimiento: new Date("2005-03-10T00:00:00Z") },
    })
    const medida = {
      operacionId: randomUUID(),
      fecha: dia(-3),
      pesoKg: 112.2,
      cinturaCm: null,
      grasaPct: 29.2,
      alturaCm: 196,
    }
    const creada = MedidaSchema.parse(
      (
        await request(http)
          .post(ruta(ids.cliente!, "medidas"))
          .set(como("cliente"))
          .send(medida)
          .expect(201)
      ).body,
    )
    const repetida = await request(http)
      .post(ruta(ids.cliente!, "medidas"))
      .set(como("cliente"))
      .send(medida)
      .expect(201)
    expect(repetida.body.id).toBe(creada.id)
    await request(http)
      .post(ruta(ids.cliente!, "medidas"))
      .set(como("cliente"))
      .send({ ...medida, pesoKg: 100 })
      .expect(409)
    await request(http)
      .post(ruta(ids.cliente!, "medidas"))
      .set(como("entrenador"))
      .send({ ...medida, operacionId: randomUUID(), fecha: dia(0), pesoKg: null, cinturaCm: 109 })
      .expect(201)
    await request(http)
      .post(ruta(ids.cliente!, "medidas"))
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        fecha: dia(0),
        pesoKg: null,
        cinturaCm: null,
        grasaPct: null,
        alturaCm: null,
      })
      .expect(400)

    const listado = ListadoMedidasSchema.parse(
      (await request(http).get(ruta(ids.cliente!, "medidas")).set(como("cliente")).expect(200))
        .body,
    )
    expect(listado.fechaNacimiento).toBe("2005-03-10")
    expect(listado.medidas.map((m) => [m.fecha, m.pesoKg, m.cinturaCm])).toEqual([
      [dia(-3), 112.2, null],
      [dia(0), null, 109],
    ])
  })

  it("registra y lista pruebas físicas", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    await request(http)
      .post(ruta(ids.cliente!, "pruebas"))
      .set(como("entrenador"))
      .send({
        operacionId: randomUUID(),
        fecha: dia(-1),
        nombre: "Flexiones seguidas",
        valor: 32,
        unidad: "reps",
      })
      .expect(201)
    const listado = ListadoPruebasSchema.parse(
      (await request(http).get(ruta(ids.cliente!, "pruebas")).set(como("cliente")).expect(200))
        .body,
    )
    expect(listado.pruebas).toEqual([
      expect.objectContaining({ nombre: "Flexiones seguidas", valor: 32, unidad: "reps" }),
    ])
  })

  it("«Fuerza» sale de las series con carga de las sesiones enviadas", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    const datos = entorno.plan()
    const plan = PlanAsignadoSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    const series = datos.patron.sesiones[0]!.ejercicios[0]!.series
    await request(http)
      .post(`/entrenamiento/sesiones/${plan.sesiones[0]!.agenda.id}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: "",
          series: [
            {
              serieId: series[0]!.id,
              tipoMedicion: "repeticiones",
              pesoKg: 30,
              repeticiones: 9,
              hecha: true,
            },
          ],
        },
      })
      .expect(200)
    const fuerza = ProgresionFuerzaSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/clientes/${ids.cliente}/fuerza`)
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(fuerza.ejercicios).toEqual([
      {
        ejercicioId: ids.ejercicio,
        nombre: expect.any(String),
        puntos: [{ fecha: "2026-09-14", pesoKg: 30, repeticiones: 9, estimado: 39 }],
      },
    ])
    await request(http)
      .get(`/entrenamiento/clientes/${ids.otro}/fuerza`)
      .set(como("cliente"))
      .expect(404)
  })
})
