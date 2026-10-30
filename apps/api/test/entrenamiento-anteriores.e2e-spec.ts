import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  ListadoAnterioresSchema,
  PlanAsignadoSchema,
  ResultadoEntrenamientoSchema,
  type AsignarPlan,
  type SeriePrescrita,
  type SerieRegistrada,
  type ValoresEjecutados,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

type EjercicioDePlan = AsignarPlan["patron"]["sesiones"][number]["ejercicios"][number]

describe("Anterior por número de serie de la última sesión enviada", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("anteriores")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function catalogo(nombre: string): Promise<string> {
    const nombreNormalizado = `e2e-entrenamiento-anteriores-${nombre}`
    const ejercicio = await entorno.prisma.ejercicio.create({
      data: {
        nombre: nombreNormalizado,
        nombreNormalizado,
        grupoPrincipal: "espalda",
        instrucciones: "Prueba de integración",
      },
    })
    return ejercicio.id
  }

  function pauta(ejercicioId: string, cantidad = 3): EjercicioDePlan {
    return {
      id: randomUUID(),
      ejercicioId,
      indicaciones: null,
      series: Array.from({ length: cantidad }, (): SeriePrescrita => ({
        id: randomUUID(),
        tipoMedicion: "repeticiones",
        pesoKg: 20,
        repeticiones: 10,
      })),
    }
  }

  async function asignar(ejercicios: EjercicioDePlan[]) {
    const plan = entorno.plan()
    plan.patron.sesiones[0]!.ejercicios = ejercicios
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(entorno.como("entrenador"))
      .send(plan)
      .expect(201)
    const id = PlanAsignadoSchema.parse(respuesta.body).sesiones[0]!.agenda.id
    return `/entrenamiento/sesiones/${id}`
  }

  const repeticiones = (pesoKg: number, cantidad: number, rir: number): ValoresEjecutados => ({
    tipoMedicion: "repeticiones",
    pesoKg,
    repeticiones: cantidad,
    rir,
  })

  function hecha(serie: SeriePrescrita, valores: ValoresEjecutados): SerieRegistrada {
    return { serieId: serie.id, ...valores, hecha: true }
  }

  async function enviar(base: string, series: SerieRegistrada[]) {
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`${base}/enviar`)
      .set(entorno.como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: { notas: null, series },
      })
      .expect(200)
    return ResultadoEntrenamientoSchema.parse(respuesta.body)
  }

  async function anteriores(base: string) {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(`${base}/anteriores`)
      .set(entorno.como("cliente"))
      .expect(200)
    return ListadoAnterioresSchema.parse(respuesta.body).anteriores
  }

  it("conserva el número histórico con resultados desordenados, UUID nuevos y huecos", async () => {
    const ejercicioId = await catalogo("numeros")
    const previa = pauta(ejercicioId)
    const basePrevia = await asignar([previa])
    const uno = repeticiones(20, 10, 3)
    const tres = repeticiones(30, 6, 1)
    const resultado = await enviar(basePrevia, [
      hecha(previa.series[2]!, tres),
      {
        serieId: previa.series[1]!.id,
        tipoMedicion: "repeticiones",
        pesoKg: null,
        repeticiones: null,
        hecha: false,
        omitida: true,
      },
      hecha(previa.series[0]!, uno),
    ])
    // El envío normaliza el orden; el histórico puede traer las mismas series en otro orden.
    await entorno.prisma.sesionEntrenamiento.update({
      where: { id: resultado.sesionId },
      data: { resultado: { ...resultado, series: [...resultado.series].reverse() } },
    })
    const actual = pauta(ejercicioId, 4)
    expect(actual.series.every((s) => previa.series.every((p) => p.id !== s.id))).toBe(true)

    expect(await anteriores(await asignar([actual]))).toEqual([
      {
        ejercicioId,
        fecha: resultado.enviadoEn,
        valores: tres,
        series: [
          { numero: 1, valores: uno },
          { numero: 3, valores: tres },
        ],
      },
    ])
  })

  it("no rellena series de una sesión antigua si la última enviada tiene menos", async () => {
    const ejercicioId = await catalogo("menos-series")
    const antigua = pauta(ejercicioId, 4)
    await enviar(
      await asignar([antigua]),
      antigua.series.map((s) => hecha(s, repeticiones(80, 10, 0))),
    )
    const ultima = pauta(ejercicioId, 2)
    const uno = repeticiones(20, 10, 3)
    const dos = repeticiones(25, 8, 2)
    const resultado = await enviar(await asignar([ultima]), [
      hecha(ultima.series[0]!, uno),
      hecha(ultima.series[1]!, dos),
    ])

    expect(await anteriores(await asignar([pauta(ejercicioId, 4)]))).toEqual([
      {
        ejercicioId,
        fecha: resultado.enviadoEn,
        valores: dos,
        series: [
          { numero: 1, valores: uno },
          { numero: 2, valores: dos },
        ],
      },
    ])
  })

  it("devuelve segundos y metros con su carga y RIR sin convertir unidades", async () => {
    const tiempoId = await catalogo("tiempo")
    const distanciaId = await catalogo("distancia")
    const tiempo = pauta(tiempoId, 1)
    tiempo.series = [{ id: randomUUID(), tipoMedicion: "tiempo", pesoKg: null, segundos: 30 }]
    const distancia = pauta(distanciaId, 1)
    distancia.tipoCarga = "conCargaExterna"
    distancia.series = [{ id: randomUUID(), tipoMedicion: "distancia", pesoKg: 20, metros: 30 }]
    const segundos: ValoresEjecutados = {
      tipoMedicion: "tiempo",
      pesoKg: null,
      segundos: 45,
      rir: 2,
    }
    const metros: ValoresEjecutados = { tipoMedicion: "distancia", pesoKg: 24, metros: 35, rir: 1 }
    const resultado = await enviar(await asignar([tiempo, distancia]), [
      hecha(distancia.series[0]!, metros),
      hecha(tiempo.series[0]!, segundos),
    ])
    const actualTiempo = {
      ...tiempo,
      id: randomUUID(),
      series: tiempo.series.map((s) => ({ ...s, id: randomUUID() })),
    }
    const actualDistancia = {
      ...distancia,
      id: randomUUID(),
      series: distancia.series.map((s) => ({ ...s, id: randomUUID() })),
    }

    const porEjercicio = new Map(
      (await anteriores(await asignar([actualTiempo, actualDistancia]))).map((a) => [
        a.ejercicioId,
        a,
      ]),
    )
    expect(porEjercicio).toEqual(
      new Map([
        [
          tiempoId,
          {
            ejercicioId: tiempoId,
            fecha: resultado.enviadoEn,
            valores: segundos,
            series: [{ numero: 1, valores: segundos }],
          },
        ],
        [
          distanciaId,
          {
            ejercicioId: distanciaId,
            fecha: resultado.enviadoEn,
            valores: metros,
            series: [{ numero: 1, valores: metros }],
          },
        ],
      ]),
    )
  })

  it("ignora el borrador, tanto si existe un envío previo como si nunca se envió", async () => {
    const enviadoId = await catalogo("con-envio")
    const privadoId = await catalogo("solo-borrador")
    const previa = pauta(enviadoId, 1)
    const valores = repeticiones(20, 10, 3)
    const resultado = await enviar(await asignar([previa]), [hecha(previa.series[0]!, valores)])
    const borrador = [pauta(enviadoId, 1), pauta(privadoId, 1)]
    const baseBorrador = await asignar(borrador)
    await request(entorno.app.getHttpServer())
      .put(`${baseBorrador}/borrador`)
      .set(entorno.como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: "Este borrador no debe aparecer",
          series: borrador.map((e) => hecha(e.series[0]!, repeticiones(90, 12, 0))),
        },
      })
      .expect(200)

    expect(await anteriores(await asignar([pauta(enviadoId), pauta(privadoId)]))).toEqual([
      {
        ejercicioId: enviadoId,
        fecha: resultado.enviadoEn,
        valores,
        series: [{ numero: 1, valores }],
      },
    ])
  })

  it("busca la última enviada de cada ejercicio y excluye la sesión actual ya enviada", async () => {
    const aId = await catalogo("sesiones-a")
    const bId = await catalogo("sesiones-b")
    const antigua = [pauta(aId, 1), pauta(bId, 1)]
    await enviar(
      await asignar(antigua),
      antigua.map((e) => hecha(e.series[0]!, repeticiones(80, 10, 0))),
    )
    const a = pauta(aId, 1)
    const valoresA = repeticiones(25, 8, 2)
    const resultadoA = await enviar(await asignar([a]), [hecha(a.series[0]!, valoresA)])
    const b = pauta(bId, 1)
    const valoresB = repeticiones(30, 6, 1)
    const resultadoB = await enviar(await asignar([b]), [hecha(b.series[0]!, valoresB)])
    const actual = [pauta(aId, 1), pauta(bId, 1)]
    const baseActual = await asignar(actual)
    await enviar(
      baseActual,
      actual.map((e) => hecha(e.series[0]!, repeticiones(100, 10, 0))),
    )

    const leidas = await anteriores(baseActual)
    expect(leidas).toEqual(
      expect.arrayContaining([
        {
          ejercicioId: aId,
          fecha: resultadoA.enviadoEn,
          valores: valoresA,
          series: [{ numero: 1, valores: valoresA }],
        },
        {
          ejercicioId: bId,
          fecha: resultadoB.enviadoEn,
          valores: valoresB,
          series: [{ numero: 1, valores: valoresB }],
        },
      ]),
    )
    expect(leidas).toHaveLength(2)
  })

  it("no rescata una sesión antigua cuando la última enviada solo tiene omisiones", async () => {
    const ejercicioId = await catalogo("sin-hechas")
    const antigua = pauta(ejercicioId, 1)
    await enviar(await asignar([antigua]), [hecha(antigua.series[0]!, repeticiones(50, 10, 1))])
    const ultima = pauta(ejercicioId, 1)
    const otro = pauta(await catalogo("hecha-en-otra-parte"), 1)
    await enviar(await asignar([ultima, otro]), [
      {
        serieId: ultima.series[0]!.id,
        tipoMedicion: "repeticiones",
        pesoKg: null,
        repeticiones: null,
        hecha: false,
        omitida: true,
      },
      hecha(otro.series[0]!, repeticiones(20, 10, 2)),
    ])

    expect(await anteriores(await asignar([pauta(ejercicioId)]))).toEqual([])
  })

  it("agrupa apariciones repetidas del ejercicio y conserva la mejor serie de cada número", async () => {
    const ejercicioId = await catalogo("repetido")
    const primera = pauta(ejercicioId, 2)
    const segunda = pauta(ejercicioId, 2)
    const uno = repeticiones(30, 6, 2)
    const dos = repeticiones(25, 10, 1)
    const resultado = await enviar(await asignar([primera, segunda]), [
      hecha(primera.series[0]!, uno),
      hecha(primera.series[1]!, repeticiones(20, 12, 3)),
      hecha(segunda.series[0]!, repeticiones(25, 8, 2)),
      hecha(segunda.series[1]!, dos),
    ])

    expect(await anteriores(await asignar([pauta(ejercicioId, 2)]))).toEqual([
      {
        ejercicioId,
        fecha: resultado.enviadoEn,
        valores: uno,
        series: [
          { numero: 1, valores: uno },
          { numero: 2, valores: dos },
        ],
      },
    ])
  })
})
