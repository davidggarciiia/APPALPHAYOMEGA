import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  ErrorDeApiSchema,
  PlanAsignadoSchema,
  PlanVigenteRespuestaSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
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

  it("asigna cada semana ajustada y cliente y entrenador leen la misma prescripción", async () => {
    const { app, como, ids } = entorno
    const datos = entorno.plan()
    const ejercicio = (compuesto: boolean, pesoKg: number | null) => ({
      id: randomUUID(),
      ejercicioId: ids.ejercicio!,
      indicaciones: null,
      compuesto,
      ...(compuesto && { subidaKg: 2.5 }),
      ...(pesoKg === null && { calibrar: true }),
      rir: { min: 3, max: 3 },
      series: Array.from({ length: 5 }, () => ({
        id: randomUUID(),
        tipoMedicion: "repeticiones" as const,
        pesoKg,
        repeticiones: 8,
      })),
    })
    const fases: Bloque["fases"] = [
      {
        desde: 1,
        hasta: 1,
        nombre: "Mayor estímulo",
        detalle: null,
        ajustes: { rirCompuestos: { min: 1, max: 2 }, rirAccesorios: { min: 1, max: 1 } },
      },
      {
        desde: 2,
        hasta: 2,
        nombre: "Descarga",
        detalle: null,
        ajustes: {
          factorSeries: 0.55,
          factorCarga: 0.875,
          rirCompuestos: { min: 3, max: 4 },
          rirAccesorios: { min: 3, max: 4 },
        },
      },
      {
        desde: 3,
        hasta: 3,
        nombre: "Vuelta",
        detalle: null,
        ajustes: { rirCompuestos: { min: 3, max: 3 }, rirAccesorios: { min: 2, max: 3 } },
      },
      { desde: 4, hasta: 4, nombre: "Base", detalle: "Como siempre" },
    ]
    const asignacion = {
      ...datos,
      semanaInicial: "2026-10-05",
      semanas: 4,
      patron: {
        sesiones: [
          {
            ...datos.patron.sesiones[0]!,
            ejercicios: [ejercicio(true, 80), ejercicio(false, 17), ejercicio(false, null)],
          },
        ],
      },
      bloque: { ...BLOQUE, fases },
    }
    const asignar = () =>
      request(app.getHttpServer())
        .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
        .set(como("entrenador"))
        .send(asignacion)
        .expect(201)
    const asignado = PlanAsignadoSchema.parse((await asignar()).body)
    const prescripciones = []
    for (const resumen of asignado.sesiones) {
      const ruta = `/entrenamiento/sesiones/${resumen.agenda.id}`
      const cliente = SesionClienteSchema.parse(
        (await request(app.getHttpServer()).get(ruta).set(como("cliente")).expect(200)).body,
      )
      const entrenador = SesionEntrenadorSchema.parse(
        (await request(app.getHttpServer()).get(ruta).set(como("entrenador")).expect(200)).body,
      )
      expect(cliente.prescripcion).toEqual(entrenador.prescripcion)
      prescripciones.push(cliente.prescripcion)
    }
    expect(prescripciones[0]?.ejercicios.map((e) => e.rir)).toEqual([
      { min: 1, max: 2 },
      { min: 1, max: 1 },
      { min: 1, max: 1 },
    ])
    expect(prescripciones[1]?.ejercicios.map((e) => e.series.length)).toEqual([5, 3, 3])
    expect(prescripciones[1]?.ejercicios.map((e) => e.series[0]?.pesoKg)).toEqual([70, 15, null])
    expect(prescripciones[1]).toMatchObject({
      fase: { nombre: "Descarga", ajustes: fases[1]?.ajustes },
    })
    expect(prescripciones[2]?.ejercicios.map((e) => e.rir)).toEqual([
      { min: 3, max: 3 },
      { min: 2, max: 3 },
      { min: 2, max: 3 },
    ])
    expect(prescripciones[3]).not.toHaveProperty("fase")
    expect(prescripciones[3]?.ejercicios.map((e) => e.series.length)).toEqual([5, 5, 5])
    expect(PlanAsignadoSchema.parse((await asignar()).body)).toEqual(asignado)

    const bloque = { ...asignacion.bloque, notas: ["Cambio de texto permitido"] }
    await request(app.getHttpServer())
      .patch(`/entrenamiento/planes/${asignado.id}/bloque`)
      .set(como("entrenador"))
      .send({ version: 1, bloque })
      .expect(200)
    const diferente = {
      ...bloque,
      fases: fases.map((fase) =>
        fase.nombre === "Descarga"
          ? { ...fase, ajustes: { ...fase.ajustes, factorSeries: 0.5 } }
          : fase,
      ),
    }
    const rechazado = await request(app.getHttpServer())
      .patch(`/entrenamiento/planes/${asignado.id}/bloque`)
      .set(como("entrenador"))
      .send({ version: 2, bloque: diferente })
      .expect(400)
    expect(rechazado.body.message).toContain("asignar")

    const sesion = asignado.sesiones[1]!
    const descarga = prescripciones[1]!
    const ajustada = await request(app.getHttpServer())
      .patch(`/entrenamiento/sesiones/${sesion.agenda.id}/prescripcion`)
      .set(como("entrenador"))
      .send({
        nombre: descarga.nombre,
        duracion: descarga.duracion,
        nota: descarga.nota,
        partes: descarga.partes,
        circuito: descarga.circuito,
        revisionPrescripcion: 0,
        ejercicios: descarga.ejercicios.map(({ nombre: _nombre, ...e }) => e),
      })
      .expect(200)
    expect(SesionEntrenadorSchema.parse(ajustada.body).prescripcion.fase).toEqual(descarga.fase)
  })
})
