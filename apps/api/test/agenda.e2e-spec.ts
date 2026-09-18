import request from "supertest"
import { PlanAsignadoSchema } from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Cambios de día dentro de la semana", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("agenda")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  async function asignar() {
    const { app, ids, como, plan } = entorno
    const datos = plan()
    datos.semanas = 2
    const respuesta = await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(datos)
      .expect(201)
    return PlanAsignadoSchema.parse(respuesta.body)
  }
  it("mueve solo la ocurrencia, registra autor y no permite salir de su semana original", async () => {
    const { app, como, prisma, ids } = entorno
    const plan = await asignar()
    const id = plan.sesiones[0]!.agenda.id
    const base = `/agenda/sesiones/${id}`
    const movida = await request(app.getHttpServer())
      .patch(`${base}/fecha`)
      .set(como("cliente"))
      .send({ fecha: "2026-09-18", revision: 0 })
      .expect(200)
    expect(movida.body).toMatchObject({
      fechaOriginal: "2026-09-14",
      fechaActual: "2026-09-18",
      revision: 1,
    })
    await request(app.getHttpServer())
      .patch(`${base}/fecha`)
      .set(como("entrenador"))
      .send({ fecha: "2026-09-20", revision: 1 })
      .expect(200)
    await request(app.getHttpServer())
      .patch(`${base}/fecha`)
      .set(como("cliente"))
      .send({ fecha: "2026-09-21", revision: 2 })
      .expect(400)
    const cambios = await request(app.getHttpServer())
      .get(`${base}/cambios`)
      .set(como("entrenador"))
      .expect(200)
    expect(cambios.body.total).toBe(2)
    expect(cambios.body.cambios.map((c: { autorId: string }) => c.autorId).sort()).toEqual(
      [ids.cliente, ids.entrenador].sort(),
    )
    expect(
      (
        await prisma.sesionProgramada.findUniqueOrThrow({
          where: { id: plan.sesiones[1]!.agenda.id },
        })
      ).fechaActual
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-09-21")
    await request(app.getHttpServer())
      .patch(`${base}/fecha`)
      .set(como("otro"))
      .send({ fecha: "2026-09-19", revision: 2 })
      .expect(404)
    for (const rol of ["nutricionista", "empleado"])
      await request(app.getHttpServer()).get(`${base}/cambios`).set(como(rol)).expect(403)
  })
  it("dos cambios concurrentes no se pisan y una sesión cerrada no se mueve", async () => {
    const { app, como, prisma } = entorno
    const plan = await asignar()
    const id = plan.sesiones[0]!.agenda.id
    const mover = (fecha: string) =>
      request(app.getHttpServer())
        .patch(`/agenda/sesiones/${id}/fecha`)
        .set(como("cliente"))
        .send({ fecha, revision: 0 })
    const resultados = await Promise.all([mover("2026-09-17"), mover("2026-09-18")])
    expect(resultados.map((r) => r.status).sort()).toEqual([200, 409])
    await prisma.sesionProgramada.update({ where: { id }, data: { estado: "cerrada" } })
    await request(app.getHttpServer())
      .patch(`/agenda/sesiones/${id}/fecha`)
      .set(como("cliente"))
      .send({ fecha: "2026-09-19", revision: 1 })
      .expect(409)
  })
})
