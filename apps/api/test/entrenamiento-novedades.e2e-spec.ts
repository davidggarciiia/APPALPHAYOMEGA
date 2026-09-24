import { randomUUID } from "node:crypto"
import request from "supertest"
import { PlanAsignadoSchema } from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Revisión explícita y novedades por usuario", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("novedades")
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
    return { id, datos, base: `/entrenamiento/sesiones/${id}` }
  }

  it("solo permite revisar una sesión enviada mediante la acción explícita", async () => {
    const { id, datos, base } = await preparar()
    const { app, como, ids } = entorno
    await request(app.getHttpServer()).put(`${base}/revision`).set(como("entrenador")).expect(409)
    await request(app.getHttpServer())
      .patch(`/agenda/sesiones/${id}/fecha`)
      .set(como("cliente"))
      .send({ fecha: "2026-09-15", revision: 0 })
      .expect(200)
    const trasMover = await request(app.getHttpServer())
      .get(base)
      .set(como("entrenador"))
      .expect(200)
    expect(trasMover.body.revisadaEn).toBeNull()
    const trainerFeed = `/entrenamiento/clientes/${ids.cliente}/novedades`
    const cambio = await request(app.getHttpServer())
      .get(trainerFeed)
      .set(como("entrenador"))
      .expect(200)
    expect(cambio.body.novedades).toEqual([
      expect.objectContaining({ sesionId: id, tipo: "fecha_cambiada", leidaEn: null }),
    ])

    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          series: [
            {
              serieId: datos.patron.sesiones[0]!.ejercicios[0]!.series[0]!.id,
              tipoMedicion: "repeticiones",
              pesoKg: 20,
              repeticiones: 10,
              hecha: true,
            },
          ],
        },
      })
      .expect(200)
    await request(app.getHttpServer()).get(base).set(como("entrenador")).expect(200)
    expect(
      (await request(app.getHttpServer()).get(base).set(como("entrenador")).expect(200)).body
        .revisadaEn,
    ).toBeNull()
    const revisada = await request(app.getHttpServer())
      .put(`${base}/revision`)
      .set(como("entrenador"))
      .expect(200)
    expect(revisada.body.revisadaEn).toEqual(expect.any(String))
    const repetida = await request(app.getHttpServer())
      .put(`${base}/revision`)
      .set(como("entrenador"))
      .expect(200)
    expect(repetida.body.revisadaEn).toBe(revisada.body.revisadaEn)
    await request(app.getHttpServer()).put(`${base}/revision`).set(como("cliente")).expect(403)
    await request(app.getHttpServer())
      .put(`${base}/revision`)
      .set(como("nutricionista"))
      .expect(403)
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/novedades`)
      .set(como("otro"))
      .expect(404)
    await request(app.getHttpServer()).get(trainerFeed).set(como("nutricionista")).expect(403)
    const cliente = await request(app.getHttpServer())
      .get(trainerFeed)
      .set(como("cliente"))
      .expect(200)
    expect(cliente.body.novedades).toEqual([
      expect.objectContaining({ tipo: "sesion_revisada", sesionId: id, leidaEn: null }),
    ])
  })

  it("marca eventos concretos solo para quien los leyó", async () => {
    const { id, datos, base } = await preparar()
    const { app, como, ids, prisma } = entorno
    const original = await prisma.usuario.findUniqueOrThrow({ where: { id: ids.entrenador } })
    const segundo = await prisma.usuario.create({
      data: {
        nombre: "segundo entrenador",
        email: "segundo@e2e-entrenamiento-novedades.test",
        passwordHash: original.passwordHash,
        rol: "entrenador",
        estado: "activo",
      },
    })
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "segundo@e2e-entrenamiento-novedades.test",
        contrasena: "Prueba-entrenamiento-2026!",
      })
      .expect(200)
    const comoSegundo = { Authorization: `Bearer ${login.body.tokenAcceso}` }
    await request(app.getHttpServer())
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          series: [
            {
              serieId: datos.patron.sesiones[0]!.ejercicios[0]!.series[0]!.id,
              tipoMedicion: "repeticiones",
              pesoKg: 20,
              repeticiones: 10,
              hecha: true,
            },
          ],
        },
      })
      .expect(200)
    const feed = `/entrenamiento/clientes/${ids.cliente}/novedades`
    const antes = await request(app.getHttpServer()).get(feed).set(como("entrenador")).expect(200)
    const novedadId = antes.body.novedades[0].id as string
    expect(antes.body.novedades[0]).toMatchObject({
      tipo: "entrenamiento_enviado",
      sesionId: id,
      leidaEn: null,
    })
    await request(app.getHttpServer())
      .post(`${base}/novedades/leidas`)
      .set(como("entrenador"))
      .send({ novedadIds: [novedadId] })
      .expect(200)
    expect(
      (await request(app.getHttpServer()).get(feed).set(como("entrenador")).expect(200)).body
        .novedades[0].leidaEn,
    ).toEqual(expect.any(String))
    expect(
      (await request(app.getHttpServer()).get(feed).set(comoSegundo).expect(200)).body.novedades[0]
        .leidaEn,
    ).toBeNull()
    await request(app.getHttpServer())
      .post(`${base}/novedades/leidas`)
      .set(como("cliente"))
      .send({ novedadIds: [novedadId] })
      .expect(404)
    await request(app.getHttpServer())
      .post(`${base}/novedades/leidas`)
      .set(como("otro"))
      .send({ novedadIds: [novedadId] })
      .expect(404)
    await prisma.usuario.delete({ where: { id: segundo.id } })
  })
})
