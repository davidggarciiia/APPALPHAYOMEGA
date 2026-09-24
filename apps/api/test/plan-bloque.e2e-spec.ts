import request from "supertest"
import {
  ErrorDeApiSchema,
  PlanAsignadoSchema,
  PlanVigenteRespuestaSchema,
  type Bloque,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

const BLOQUE: Bloque = {
  objetivos: ["Bajar grasa sin perder músculo", "Técnica y progresión, sin fallo"],
  fases: [
    { desde: 1, hasta: 2, nombre: "Calibrar", detalle: "RIR 3 · accesorios 2–3" },
    { desde: 3, hasta: 4, nombre: "Progresar", detalle: "Más reps y carga" },
    { desde: 5, hasta: 5, nombre: "Apretar", detalle: null },
    { desde: 6, hasta: 6, nombre: "Descarga", detalle: "Mitad de series · RIR 3–4" },
  ],
  deportes: [{ nombre: "K-1", dias: [4, 7], minutos: 60 }],
  notas: ["Nada de K-1 los miércoles"],
}

describe("Bloque del plan", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("bloque")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function asignar(bloque?: Bloque) {
    const datos = {
      ...entorno.plan(),
      nombre: "Bloque 1 · Recomposición",
      semanaInicial: "2026-10-05",
      semanas: 6,
      ...(bloque && { bloque }),
    }
    const r = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
    return r
  }

  it("el cliente lee el bloque de la semana que consulta", async () => {
    const { app, como, ids } = entorno
    const asignado = PlanAsignadoSchema.parse((await asignar(BLOQUE)).body)

    const r = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/plan?semana=2026-10-12`)
      .set(como("cliente"))
      .expect(200)
    expect(PlanVigenteRespuestaSchema.parse(r.body).plan).toEqual({
      id: asignado.id,
      nombre: "Bloque 1 · Recomposición",
      semanaInicial: "2026-10-05",
      semanas: 6,
      version: 1,
      bloque: BLOQUE,
    })

    const fuera = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/plan?semana=2026-11-16`)
      .set(como("entrenador"))
      .expect(200)
    expect(fuera.body).toEqual({ plan: null })
  })

  it("un plan sin bloque se lee con bloque nulo", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer())
      .post(`/entrenamiento/clientes/${ids.otro}/planes`)
      .set(como("entrenador"))
      .send({ ...entorno.plan(), semanaInicial: "2026-10-05" })
      .expect(201)
    const r = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.otro}/plan?semana=2026-10-05`)
      .set(como("entrenador"))
      .expect(200)
    expect(PlanVigenteRespuestaSchema.parse(r.body).plan?.bloque).toBeNull()
  })

  it("nadie más lee el plan de un cliente", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.otro}/plan?semana=2026-10-05`)
      .set(como("cliente"))
      .expect(404)
    await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.cliente}/plan?semana=2026-10-05`)
      .set(como("nutricionista"))
      .expect(403)
  })

  it("el entrenador cambia el bloque con la versión que leyó", async () => {
    const { app, como, ids } = entorno
    const asignado = PlanAsignadoSchema.parse((await asignar(BLOQUE)).body)
    const nuevo: Bloque = { ...BLOQUE, notas: ["Fuerza y K-1 el mismo día: separados"] }

    const r = await request(app.getHttpServer())
      .patch(`/entrenamiento/planes/${asignado.id}/bloque`)
      .set(como("entrenador"))
      .send({ version: 1, bloque: nuevo })
      .expect(200)
    expect(PlanVigenteRespuestaSchema.parse({ plan: r.body }).plan).toMatchObject({
      version: 2,
      bloque: nuevo,
    })

    const viejo = await request(app.getHttpServer())
      .patch(`/entrenamiento/planes/${asignado.id}/bloque`)
      .set(como("entrenador"))
      .send({ version: 1, bloque: BLOQUE })
      .expect(409)
    ErrorDeApiSchema.parse(viejo.body)

    await request(app.getHttpServer())
      .patch(`/entrenamiento/planes/${asignado.id}/bloque`)
      .set(como("cliente"))
      .send({ version: 2, bloque: BLOQUE })
      .expect(403)
    void ids
  })

  it("rechaza fases fuera de las semanas del plan", async () => {
    const r = await asignar({
      ...BLOQUE,
      fases: [{ desde: 5, hasta: 8, nombre: "Apretar", detalle: null }],
    })
    expect(r.status).toBe(400)
  })
})
