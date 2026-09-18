import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  PlanAsignadoSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
  ListadoSesionesSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Asignación y acceso a entrenamientos", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("asignacion")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("asigna una copia real y separa los DTO del cliente y del entrenador", async () => {
    const { app, como, ids, plan } = entorno
    const respuesta = await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(plan())
      .expect(201)
    const asignado = PlanAsignadoSchema.parse(respuesta.body)
    const sesionId = asignado.sesiones[0]!.agenda.id
    const entrenador = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${sesionId}`)
      .set(como("entrenador"))
      .expect(200)
    expect(SesionEntrenadorSchema.parse(entrenador.body).prescripcion.ejercicios[0]?.nombre).toBe(
      "e2e-entrenamiento-asignacion",
    )
    expect(entrenador.body).not.toHaveProperty("borrador")
    const cliente = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${sesionId}`)
      .set(como("cliente"))
      .expect(200)
    expect(SesionClienteSchema.parse(cliente.body).borrador).toBeNull()
    const listado = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/sesiones?semana=2026-09-14`)
      .set(como("cliente"))
      .expect(200)
    expect(
      ListadoSesionesSchema.parse(listado.body).sesiones.some(
        (sesion) => sesion.agenda.id === sesionId,
      ),
    ).toBe(true)
    for (const rol of ["otro", "nutricionista", "empleado"]) {
      expect(
        (
          await request(app.getHttpServer())
            .get(`/entrenamiento/sesiones/${sesionId}`)
            .set(como(rol))
        ).status,
      ).toBe(rol === "otro" ? 404 : 403)
      expect(
        (
          await request(app.getHttpServer())
            .get(`/entrenamiento/clientes/${ids.cliente}/sesiones?semana=2026-09-14`)
            .set(como(rol))
        ).status,
      ).toBe(rol === "otro" ? 404 : 403)
    }
    const ajena = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${sesionId}`)
      .set(como("otro"))
    const ausente = await request(app.getHttpServer())
      .get(`/entrenamiento/sesiones/${randomUUID()}`)
      .set(como("otro"))
    expect(ajena.body).toEqual(ausente.body)
    await request(app.getHttpServer()).get(`/entrenamiento/sesiones/${sesionId}`).expect(401)
  })

  it("dos asignaciones concurrentes con la misma operación crean un solo plan", async () => {
    const { app, como, ids, plan, prisma } = entorno
    const datos = plan()
    const peticion = (): request.Test =>
      request(app.getHttpServer())
        .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
        .set(como("entrenador"))
        .send(datos)
    const [primera, segunda] = await Promise.all([peticion(), peticion()])
    expect([primera.status, segunda.status]).toEqual([201, 201])
    expect(primera.body).toEqual(segunda.body)
    expect(
      await prisma.planEntrenamiento.count({ where: { operacionId: datos.operacionId } }),
    ).toBe(1)
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send({ ...datos, nombre: "Otra rutina" })
      .expect(409)
  })

  it("permite pendientes, deniega nuevas asignaciones a bajas y conserva el replay", async () => {
    const { app, como, ids, plan, prisma } = entorno
    const datos = plan()
    const url = `/entrenamiento/clientes/${ids.pendiente}/planes`
    const primera = await request(app.getHttpServer())
      .post(url)
      .set(como("entrenador"))
      .send(datos)
      .expect(201)
    await prisma.usuario.update({ where: { id: ids.pendiente }, data: { estado: "desactivado" } })
    const repetida = await request(app.getHttpServer())
      .post(url)
      .set(como("entrenador"))
      .send(datos)
      .expect(201)
    expect(repetida.body).toEqual(primera.body)
    await request(app.getHttpServer()).post(url).set(como("entrenador")).send(plan()).expect(409)
    for (const rol of ["cliente", "nutricionista", "empleado"]) {
      await request(app.getHttpServer())
        .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
        .set(como(rol))
        .send(plan())
        .expect(403)
    }
  })

  it("rechaza ejercicios retirados y cuerpos inválidos sin crear planes", async () => {
    const { app, como, ids, plan, prisma } = entorno
    await prisma.ejercicio.update({ where: { id: ids.ejercicio }, data: { estado: "retirado" } })
    const antes = await prisma.planEntrenamiento.count()
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send(plan())
      .expect(400)
    expect(await prisma.planEntrenamiento.count()).toBe(antes)
    await prisma.ejercicio.update({ where: { id: ids.ejercicio }, data: { estado: "publicado" } })
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
      .set(como("entrenador"))
      .send({ ...plan(), semanaInicial: "2026-09-15" })
      .expect(400)
  })
})
