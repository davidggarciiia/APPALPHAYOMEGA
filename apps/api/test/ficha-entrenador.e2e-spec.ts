import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ComentarioSesionSchema,
  ListadoComentariosSchema,
  ListadoResultadosSchema,
  PlanAsignadoSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Ficha del cliente para el entrenador", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let sesionId: string
  let ejercicioPrescritoId: string
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("ficha")
    const { app, como, ids } = entorno
    const datos = entorno.plan()
    const plan = PlanAsignadoSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    sesionId = plan.sesiones[0]!.agenda.id
    ejercicioPrescritoId = datos.patron.sesiones[0]!.ejercicios[0]!.id
    const serie = datos.patron.sesiones[0]!.ejercicios[0]!.series[0]!
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${sesionId}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: "",
          series: [
            {
              serieId: serie.id,
              tipoMedicion: "repeticiones",
              pesoKg: 20,
              repeticiones: 10,
              hecha: true,
              rir: 2,
            },
          ],
          checkin: { sensacion: 4, molestia: "nada" },
          cierre: { esfuerzo: 7, energia: 3, incomodo: false },
          inicio: "2026-09-14T17:00:00.000Z",
        },
      })
      .expect(200)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("el entrenador lista los resultados recientes con check-in y cierre", async () => {
    const { app, como, ids } = entorno
    const r = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/resultados?limite=5`)
      .set(como("entrenador"))
      .expect(200)
    const { resultados } = ListadoResultadosSchema.parse(r.body)
    expect(resultados).toHaveLength(1)
    expect(resultados[0]!.agenda.id).toBe(sesionId)
    expect(resultados[0]!.resultado.cierre).toEqual({ esfuerzo: 7, energia: 3, incomodo: false })
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.otro}/resultados`)
      .set(como("cliente"))
      .expect(404)
  })

  it("comenta la sesión o un ejercicio; repetir la operación no duplica", async () => {
    const { app, como } = entorno
    const http = app.getHttpServer()
    const operacionId = randomUUID()
    const cuerpo = {
      operacionId,
      ejercicioPrescritoId,
      texto: "Buena calibración. Mantén la carga.",
    }
    const primero = ComentarioSesionSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
          .set(como("entrenador"))
          .send(cuerpo)
          .expect(201)
      ).body,
    )
    expect(primero.autor.rol).toBe("entrenador")
    expect(primero.ejercicio).toEqual(expect.any(String))
    const repetido = await request(http)
      .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("entrenador"))
      .send(cuerpo)
      .expect(201)
    expect(repetido.body.id).toBe(primero.id)
    await request(http)
      .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("cliente"))
      .send({ operacionId: randomUUID(), ejercicioPrescritoId: null, texto: "¡Gracias!" })
      .expect(201)

    const listado = ListadoComentariosSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/sesiones/${sesionId}/comentarios`)
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(listado.comentarios.map((c) => c.texto)).toEqual([
      "Buena calibración. Mantén la carga.",
      "¡Gracias!",
    ])
  })

  it("rechaza ejercicios ajenos, textos vacíos y a quien no es de la sesión", async () => {
    const { app, como } = entorno
    const http = app.getHttpServer()
    await request(http)
      .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), ejercicioPrescritoId: randomUUID(), texto: "Hola" })
      .expect(400)
    await request(http)
      .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), ejercicioPrescritoId: null, texto: "   " })
      .expect(400)
    await request(http)
      .post(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("otro"))
      .send({ operacionId: randomUUID(), ejercicioPrescritoId: null, texto: "Hola" })
      .expect(404)
    await request(http)
      .get(`/entrenamiento/sesiones/${sesionId}/comentarios`)
      .set(como("nutricionista"))
      .expect(403)
  })
})
