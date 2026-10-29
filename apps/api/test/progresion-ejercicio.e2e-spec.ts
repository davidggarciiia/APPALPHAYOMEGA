import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ListadoResultadosSchema,
  PlanAsignadoSchema,
  ProgresionFuerzaSchema,
  ResumenSemanalSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Progresión de todos los ejercicios del cliente", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("progresion-ejercicio")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("devuelve más de seis ejercicios enviados y excluye las series de los borradores", async () => {
    const { app, como, ids, prisma } = entorno
    const http = app.getHttpServer()
    const ejercicios = await Promise.all(
      Array.from({ length: 8 }, (_, n) =>
        prisma.ejercicio.create({
          data: {
            nombre: `e2e-entrenamiento-progresion-ejercicio ${n}`,
            nombreNormalizado: `e2e-entrenamiento-progresion-ejercicio ${n}`,
            grupoPrincipal: "espalda",
            instrucciones: "Prueba de progresión",
          },
        }),
      ),
    )
    const prescritos = ejercicios.map((ejercicio) => ({
      id: randomUUID(),
      ejercicioId: ejercicio.id,
      indicaciones: null,
      series: [
        { id: randomUUID(), tipoMedicion: "repeticiones" as const, pesoKg: 30, repeticiones: 10 },
      ],
    }))
    const datos = entorno.plan()
    datos.patron.sesiones = [
      { id: randomUUID(), nombre: "Enviada", diaSemana: 1, ejercicios: prescritos.slice(0, 7) },
      { id: randomUUID(), nombre: "Borrador", diaSemana: 2, ejercicios: prescritos.slice(7) },
    ]
    const plan = PlanAsignadoSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    const registro = (desde: number, hasta: number) => ({
      operacionId: randomUUID(),
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro: {
        notas: null,
        series: prescritos.slice(desde, hasta).map((ejercicio) => ({
          serieId: ejercicio.series[0]!.id,
          tipoMedicion: "repeticiones",
          pesoKg: 30,
          repeticiones: 10,
          hecha: true,
          rir: 2,
        })),
      },
    })
    await request(http)
      .post(`/entrenamiento/sesiones/${plan.sesiones[0]!.agenda.id}/enviar`)
      .set(como("cliente"))
      .send(registro(0, 7))
      .expect(200)
    await request(http)
      .put(`/entrenamiento/sesiones/${plan.sesiones[1]!.agenda.id}/borrador`)
      .set(como("cliente"))
      .send(registro(7, 8))
      .expect(200)

    const fuerza = ProgresionFuerzaSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/clientes/${ids.cliente}/fuerza`)
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(fuerza.ejercicios.map((ejercicio) => ejercicio.ejercicioId)).toEqual(
      ejercicios.slice(0, 7).map((ejercicio) => ejercicio.id),
    )
    expect(fuerza.ejercicios.every(({ puntos }) => puntos[0]?.estimado === 40)).toBe(true)
    const { resultados } = ListadoResultadosSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/clientes/${ids.cliente}/resultados?limite=60`)
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(resultados.map(({ agenda }) => agenda.id)).toEqual([plan.sesiones[0]!.agenda.id])
    expect(resultados[0]?.resultado.series).toHaveLength(7)
  })

  // Sustituye F: «usa la serie con mayor Epley para la gráfica, aunque otra tenga más kg».
  it("fuerza y resumen semanal eligen por carga y luego repeticiones aunque otra serie tenga mayor Epley", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    const datos = entorno.plan()
    datos.semanaInicial = "2026-09-21"
    const primera = datos.patron.sesiones[0]!.ejercicios[0]!
    primera.compuesto = true
    const series = [
      { id: randomUUID(), tipoMedicion: "repeticiones" as const, pesoKg: 60, repeticiones: 10 },
      { id: randomUUID(), tipoMedicion: "repeticiones" as const, pesoKg: 100, repeticiones: 10 },
      { id: randomUUID(), tipoMedicion: "repeticiones" as const, pesoKg: 62.5, repeticiones: 6 },
      { id: randomUUID(), tipoMedicion: "repeticiones" as const, pesoKg: 62.5, repeticiones: 7 },
    ]
    datos.patron.sesiones[0]!.ejercicios = [
      { ...primera, series: series.slice(0, 2) },
      { ...primera, id: randomUUID(), series: series.slice(2) },
    ]
    const plan = PlanAsignadoSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    await request(http)
      .post(`/entrenamiento/sesiones/${plan.sesiones[0]!.agenda.id}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          series: series.map(({ id, ...valores }, n) =>
            n === 1
              ? { ...valores, serieId: id, hecha: false, omitida: true }
              : { ...valores, serieId: id, hecha: true, rir: null },
          ),
        },
      })
      .expect(200)
    const fuerza = ProgresionFuerzaSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/clientes/${ids.cliente}/fuerza`)
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(fuerza.ejercicios.find((e) => e.ejercicioId === ids.ejercicio)?.puntos).toEqual([
      { fecha: "2026-09-21", pesoKg: 62.5, repeticiones: 7, estimado: 77.1 },
    ])
    const resumen = ResumenSemanalSchema.parse(
      (
        await request(http)
          .get("/entrenamiento/resumen-semanal?semana=2026-09-21")
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(
      resumen.clientes
        .find((c) => c.clienteId === ids.cliente)
        ?.ejercicios.find((e) => e.ejercicioId === ids.ejercicio)?.mejorSerie,
    ).toMatchObject({ pesoKg: 62.5, repeticiones: 7, estimado1RM: 77.1 })
  })

  it("excluye aproximaciones, circuito y vuelta a la calma aunque compartan ejercicio con la parte principal", async () => {
    const { app, como, ids, prisma } = entorno
    const http = app.getHttpServer()
    const auxiliar = await prisma.ejercicio.create({
      data: {
        nombre: "e2e-entrenamiento-progresion-ejercicio aproximaciones",
        nombreNormalizado: "e2e-entrenamiento-progresion-ejercicio aproximaciones",
        grupoPrincipal: "pecho",
        instrucciones: "Aproximación",
      },
    })
    const datos = entorno.plan()
    datos.semanaInicial = "2026-09-28"
    const principal = datos.patron.sesiones[0]!.ejercicios[0]!
    principal.seccion = "principal"
    principal.series = [
      { id: randomUUID(), tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 },
    ]
    datos.patron.sesiones[0]!.ejercicios = [
      principal,
      ...(["calentamiento", "circuito", "final"] as const).flatMap((seccion) =>
        [ids.ejercicio!, auxiliar.id].map((ejercicioId) => ({
          ...principal,
          id: randomUUID(),
          ejercicioId,
          seccion,
          series: [
            {
              id: randomUUID(),
              tipoMedicion: "repeticiones" as const,
              pesoKg: 500,
              repeticiones: 10,
            },
          ],
        })),
      ),
    ]
    const plan = PlanAsignadoSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    await request(http)
      .post(`/entrenamiento/sesiones/${plan.sesiones[0]!.agenda.id}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          series: datos.patron.sesiones[0]!.ejercicios.flatMap((e) =>
            e.series.map(({ id, ...s }) => ({ ...s, serieId: id, hecha: true, rir: null })),
          ),
        },
      })
      .expect(200)
    const fuerza = ProgresionFuerzaSchema.parse(
      (
        await request(http)
          .get(`/entrenamiento/clientes/${ids.cliente}/fuerza`)
          .set(como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(fuerza.ejercicios.map((e) => e.ejercicioId)).not.toContain(auxiliar.id)
    expect(fuerza.ejercicios.find((e) => e.ejercicioId === ids.ejercicio)?.puntos.at(-1)).toEqual({
      fecha: "2026-09-28",
      pesoKg: 40,
      repeticiones: 10,
      estimado: 53.3,
    })
  })
})
