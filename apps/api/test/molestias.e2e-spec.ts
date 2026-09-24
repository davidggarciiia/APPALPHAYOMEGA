import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ErrorDeApiSchema,
  ListadoMolestiasSchema,
  MolestiaSchema,
  PlanAsignadoSchema,
  type RegistrarMolestia,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Molestias durante el entrenamiento", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("molestias")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function sesion(): Promise<{ id: string; ejercicioPrescritoId: string }> {
    const datos = entorno.plan()
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
      .expect(201)
    return {
      id: PlanAsignadoSchema.parse(respuesta.body).sesiones[0]!.agenda.id,
      ejercicioPrescritoId: datos.patron.sesiones[0]!.ejercicios[0]!.id,
    }
  }

  function aviso(ejercicioPrescritoId: string | null): RegistrarMolestia {
    return {
      operacionId: randomUUID(),
      ejercicioPrescritoId,
      serie: ejercicioPrescritoId === null ? null : 2,
      zona: "hombro",
      intensidad: 4,
      sintomas: ["va_a_mas"],
      nota: null,
    }
  }

  it("el cliente avisa en su sesión; repetir la operación no duplica", async () => {
    const { app, como } = entorno
    const { id, ejercicioPrescritoId } = await sesion()
    const datos = aviso(ejercicioPrescritoId)

    const creada = await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send(datos)
      .expect(201)
    const molestia = MolestiaSchema.parse(creada.body)
    expect(molestia).toMatchObject({
      sesionId: id,
      serie: 2,
      zona: "hombro",
      nivel: "ambar",
      estado: "abierta",
      ejercicio: "e2e-entrenamiento-molestias",
    })

    const repetida = await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send(datos)
      .expect(201)
    expect(repetida.body.id).toBe(molestia.id)

    const distinta = await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send({ ...datos, intensidad: 8 })
      .expect(409)
    expect(ErrorDeApiSchema.parse(distinta.body).codigo).toBe("operacion_incompatible")
  })

  it("rechaza ejercicios o series que no son de la sesión y valores fuera de rango", async () => {
    const { app, como } = entorno
    const { id, ejercicioPrescritoId } = await sesion()
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send(aviso(randomUUID()))
      .expect(400)
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send({ ...aviso(ejercicioPrescritoId), serie: 30 })
      .expect(400)
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send({ ...aviso(null), intensidad: 11 })
      .expect(400)
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send({ ...aviso(null), sintomas: ["rigidez", "rigidez"] })
      .expect(400)
  })

  it("solo el cliente de la sesión avisa; solo él y el entrenador leen", async () => {
    const { app, como, ids } = entorno
    const { id } = await sesion()
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("otro"))
      .send(aviso(null))
      .expect(404)
    for (const rol of ["entrenador", "nutricionista", "empleado"]) {
      await request(app.getHttpServer())
        .post(`/entrenamiento/sesiones/${id}/molestias`)
        .set(como(rol))
        .send(aviso(null))
        .expect(403)
    }
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/molestias`)
      .set(como("otro"))
      .expect(404)
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/molestias`)
      .set(como("nutricionista"))
      .expect(403)
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/molestias`)
      .set(como("cliente"))
      .expect(200)
  })

  it("el entrenador responde y la molestia sale de las abiertas", async () => {
    const { app, como, ids } = entorno
    const { id, ejercicioPrescritoId } = await sesion()
    const creada = await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${id}/molestias`)
      .set(como("cliente"))
      .send({ ...aviso(ejercicioPrescritoId), intensidad: 8, sintomas: ["pinchazo"] })
      .expect(201)
    const molestia = MolestiaSchema.parse(creada.body)
    expect(molestia.nivel).toBe("rojo")

    const abiertas = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/molestias?estado=abierta`)
      .set(como("entrenador"))
      .expect(200)
    expect(ListadoMolestiasSchema.parse(abiertas.body).molestias.map((m) => m.id)).toContain(
      molestia.id,
    )

    await request(app.getHttpServer())
      .post(`/entrenamiento/molestias/${molestia.id}/atender`)
      .set(como("cliente"))
      .send({ respuesta: "Nada" })
      .expect(403)
    const atendida = await request(app.getHttpServer())
      .post(`/entrenamiento/molestias/${molestia.id}/atender`)
      .set(como("entrenador"))
      .send({ respuesta: "Cambia a press en multipower y baja a 22 kg." })
      .expect(200)
    expect(MolestiaSchema.parse(atendida.body)).toMatchObject({
      estado: "atendida",
      respuesta: "Cambia a press en multipower y baja a 22 kg.",
    })
    await request(app.getHttpServer())
      .post(`/entrenamiento/molestias/${molestia.id}/atender`)
      .set(como("entrenador"))
      .send({ respuesta: "Cambia a press en multipower y baja a 22 kg." })
      .expect(200)
    await request(app.getHttpServer())
      .post(`/entrenamiento/molestias/${molestia.id}/atender`)
      .set(como("entrenador"))
      .send({ respuesta: "Otra respuesta" })
      .expect(409)

    const despues = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/molestias?estado=abierta`)
      .set(como("entrenador"))
      .expect(200)
    expect(ListadoMolestiasSchema.parse(despues.body).molestias.map((m) => m.id)).not.toContain(
      molestia.id,
    )
  })
})
