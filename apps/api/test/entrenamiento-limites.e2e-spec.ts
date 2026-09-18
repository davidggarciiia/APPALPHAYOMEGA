import { randomUUID } from "node:crypto"
import request from "supertest"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Límites reales de asignación", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("limites")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  it("acepta un plan válido mayor de 100 KiB y rechaza más de 10.000 series expandidas", async () => {
    const { app, como, ids, plan } = entorno
    const datos = plan()
    const sesion = datos.patron.sesiones[0]!
    const ejercicio = sesion.ejercicios[0]!
    sesion.ejercicios = Array.from({ length: 40 }, () => ({
      ...ejercicio,
      id: randomUUID(),
      indicaciones: "Controla el movimiento. ".repeat(70),
      series: Array.from({ length: 30 }, () => ({
        id: randomUUID(),
        tipoMedicion: "repeticiones" as const,
        pesoKg: 20,
        repeticiones: 10,
      })),
    }))
    expect(Buffer.byteLength(JSON.stringify(datos))).toBeGreaterThan(100 * 1024)
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(datos)
      .expect(201)
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send({ ...datos, operacionId: randomUUID(), semanas: 9 })
      .expect(400)
  })
})
