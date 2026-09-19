import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  PlanAsignadoSchema,
  RutinaGuardadaSchema,
  SesionEntrenadorSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Rutinas reutilizables y ajustes seguros", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("rutinas")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  it("editar una rutina no modifica planes asignados y se puede asignar a varias semanas", async () => {
    const { app, como, ids, plan } = entorno
    const datos = plan()
    const creada = await request(app.getHttpServer())
      .post("/entrenamiento/rutinas")
      .set(como("entrenador"))
      .send({ nombre: "Base", patron: datos.patron })
      .expect(201)
    const rutina = RutinaGuardadaSchema.parse(creada.body)
    const respuesta = await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send({ ...datos, semanas: 2 })
      .expect(201)
    const asignado = PlanAsignadoSchema.parse(respuesta.body)
    expect(asignado.sesiones.map((s) => s.agenda.fechaOriginal)).toEqual([
      "2026-09-14",
      "2026-09-21",
    ])
    datos.patron.sesiones[0]!.nombre = "Sesión modificada"
    await request(app.getHttpServer())
      .patch(`/entrenamiento/rutinas/${rutina.id}`)
      .set(como("entrenador"))
      .send({ nombre: "Nueva base", patron: datos.patron, revision: 0 })
      .expect(200)
    await request(app.getHttpServer())
      .patch(`/entrenamiento/rutinas/${rutina.id}`)
      .set(como("entrenador"))
      .send({ nombre: "Obsoleta", patron: datos.patron, revision: 0 })
      .expect(409)
    const sesion = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${asignado.sesiones[0]!.agenda.id}`)
      .set(como("entrenador"))
      .expect(200)
    expect(sesion.body.prescripcion.nombre).toBe("Fuerza")
    const listado = await request(app.getHttpServer())
      .get("/entrenamiento/rutinas?buscar=Nueva")
      .set(como("entrenador"))
      .expect(200)
    expect(listado.body.rutinas[0].id).toBe(rutina.id)
    for (const rol of ["cliente", "nutricionista", "empleado"])
      await request(app.getHttpServer())
        .get(`/entrenamiento/rutinas/${rutina.id}`)
        .set(como(rol))
        .expect(403)
  })
  it("ajusta una sola sesión, rechaza revisiones viejas y congela al guardar el primer borrador", async () => {
    const { app, como, ids, plan } = entorno
    const datos = plan()
    const respuesta = await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send({ ...datos, semanas: 2 })
      .expect(201)
    const asignado = PlanAsignadoSchema.parse(respuesta.body)
    const id = asignado.sesiones[0]!.agenda.id
    const base = `/entrenamiento/sesiones/${id}`
    const ajuste = {
      nombre: "Personalizada",
      ejercicios: datos.patron.sesiones[0]!.ejercicios,
      revisionPrescripcion: 0,
    }
    const ajustada = await request(app.getHttpServer())
      .patch(`${base}/prescripcion`)
      .set(como("entrenador"))
      .send(ajuste)
      .expect(200)
    expect(SesionEntrenadorSchema.parse(ajustada.body).revisionPrescripcion).toBe(1)
    await request(app.getHttpServer())
      .patch(`${base}/prescripcion`)
      .set(como("entrenador"))
      .send(ajuste)
      .expect(409)
    const siguiente = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${asignado.sesiones[1]!.agenda.id}`)
      .set(como("entrenador"))
      .expect(200)
    expect(siguiente.body.prescripcion.nombre).toBe("Fuerza")
    const borrador = {
      operacionId: randomUUID(),
      revisionPrescripcion: 1,
      revisionBorrador: 0,
      registro: { series: [], notas: null },
    }
    await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
    await request(app.getHttpServer())
      .patch(`${base}/prescripcion`)
      .set(como("entrenador"))
      .send({ ...ajuste, revisionPrescripcion: 1 })
      .expect(409)
    await request(app.getHttpServer())
      .patch(`${base}/prescripcion`)
      .set(como("cliente"))
      .send(ajuste)
      .expect(403)
  })

  it("adapta la copia para otro cliente y conserva consultas tras retirar un ejercicio", async () => {
    const { app, como, ids, plan, prisma } = entorno
    const base = plan()
    const creada = await request(app.getHttpServer())
      .post("/entrenamiento/rutinas")
      .set(como("entrenador"))
      .send({ nombre: "Independiente", patron: base.patron })
      .expect(201)
    const rutina = RutinaGuardadaSchema.parse(creada.body)
    const lectura = await request(app.getHttpServer())
      .get("/entrenamiento/rutinas/" + rutina.id)
      .set(como("entrenador"))
      .expect(200)
    expect(RutinaGuardadaSchema.parse(lectura.body)).toEqual(rutina)
    const primero = await request(app.getHttpServer())
      .post("/entrenamiento/clientes/" + ids.cliente + "/planes")
      .set(como("entrenador"))
      .send({ ...base, patron: rutina.patron })
      .expect(201)
    const copia = structuredClone(rutina.patron)
    copia.sesiones[0]!.nombre = "Adaptada para otro cliente"
    await request(app.getHttpServer())
      .post("/entrenamiento/clientes/" + ids.otro + "/planes")
      .set(como("entrenador"))
      .send({ ...plan(), patron: copia })
      .expect(201)
    const id = PlanAsignadoSchema.parse(primero.body).sesiones[0]!.agenda.id
    await prisma.ejercicio.update({
      where: { id: ids.ejercicio },
      data: { estado: "retirado", retiradoEn: new Date() },
    })
    const original = await request(app.getHttpServer())
      .get("/entrenamiento/sesiones/" + id)
      .set(como("cliente"))
      .expect(200)
    expect(original.body.prescripcion.nombre).toBe("Fuerza")
    const conservada = await request(app.getHttpServer())
      .get("/entrenamiento/rutinas/" + rutina.id)
      .set(como("entrenador"))
      .expect(200)
    expect(RutinaGuardadaSchema.parse(conservada.body).patron).toEqual(rutina.patron)
    await request(app.getHttpServer())
      .post("/entrenamiento/clientes/" + ids.otro + "/planes")
      .set(como("entrenador"))
      .send({ ...plan(), patron: copia })
      .expect(400)
    await request(app.getHttpServer())
      .patch("/entrenamiento/rutinas/" + rutina.id)
      .set(como("entrenador"))
      .send({ nombre: "Rechazada", patron: copia, revision: 0 })
      .expect(400)
    for (const rol of ["cliente", "nutricionista", "empleado"]) {
      await request(app.getHttpServer())
        .post("/entrenamiento/rutinas")
        .set(como(rol))
        .send({ nombre: "No permitida", patron: copia })
        .expect(403)
      await request(app.getHttpServer())
        .patch("/entrenamiento/rutinas/" + rutina.id)
        .set(como(rol))
        .send({ nombre: "No permitida", patron: copia, revision: 0 })
        .expect(403)
    }
    await request(app.getHttpServer())
      .get("/entrenamiento/rutinas/" + randomUUID())
      .set(como("entrenador"))
      .expect(404)
    await request(app.getHttpServer())
      .patch("/entrenamiento/rutinas/" + randomUUID())
      .set(como("entrenador"))
      .send({ nombre: "No existe", patron: copia, revision: 0 })
      .expect(404)
    await request(app.getHttpServer())
      .get("/entrenamiento/rutinas/" + rutina.id)
      .expect(401)
  })
})
