import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  estimar1RM,
  PlanAsignadoSchema,
  ResultadoEntrenamientoSchema,
  RutinaGuardadaSchema,
  SerieRegistradaDistanciaSchema,
  SerieRegistradaSchema,
  ValoresEjecutadosDistanciaSchema,
  ValoresEjecutadosSchema,
  type GuardarBorrador,
  type ValoresEjecutados,
  type ValoresEjecutadosDistancia,
} from "@alpha-omega/shared"
import { valoresHechos } from "../src/entrenamiento/registros.service.js"
import { mejorSerie } from "../src/entrenamiento/sesiones.service.js"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

// D01 · Distancia en metros. Datos sintéticos: ningún dato real de clientes.
const repeticiones = (pesoKg: number | null, cantidad: number): ValoresEjecutados =>
  ValoresEjecutadosSchema.parse({ tipoMedicion: "repeticiones", pesoKg, repeticiones: cantidad })
const segundos = (pesoKg: number | null, cantidad: number): ValoresEjecutados =>
  ValoresEjecutadosSchema.parse({ tipoMedicion: "tiempo", pesoKg, segundos: cantidad })
const metros = (pesoKg: number | null, cantidad: number): ValoresEjecutadosDistancia =>
  ValoresEjecutadosDistanciaSchema.parse({ tipoMedicion: "distancia", pesoKg, metros: cantidad })

describe("Lo hecho y las métricas en metros (D01.f)", () => {
  it("lo hecho guarda metros y carga como metros, nunca como repeticiones ni segundos", () => {
    const serieId = randomUUID()
    const transporte = SerieRegistradaDistanciaSchema.parse({
      serieId,
      tipoMedicion: "distancia",
      pesoKg: 32,
      metros: 18,
      rir: 2,
      hecha: true,
    })
    const hecho = valoresHechos(transporte)
    expect(hecho).toEqual({ tipoMedicion: "distancia", pesoKg: 32, rir: 2, metros: 18 })
    expect(ValoresEjecutadosDistanciaSchema.parse(hecho)).toEqual(hecho)
    const sinCarga = SerieRegistradaDistanciaSchema.parse({
      serieId,
      tipoMedicion: "distancia",
      pesoKg: null,
      metros: 30,
      hecha: true,
    })
    expect(valoresHechos(sinCarga)).toEqual({
      tipoMedicion: "distancia",
      pesoKg: null,
      rir: null,
      metros: 30,
    })
    // Repeticiones y segundos se guardan igual que antes.
    const press = SerieRegistradaSchema.parse({
      serieId,
      tipoMedicion: "repeticiones",
      pesoKg: 22.5,
      repeticiones: 8,
      hecha: true,
    })
    expect(valoresHechos(press)).toEqual({
      tipoMedicion: "repeticiones",
      pesoKg: 22.5,
      rir: null,
      repeticiones: 8,
    })
    const plancha = SerieRegistradaSchema.parse({
      serieId,
      tipoMedicion: "tiempo",
      pesoKg: null,
      segundos: 40,
      rir: 1,
      hecha: true,
    })
    expect(valoresHechos(plancha)).toEqual({
      tipoMedicion: "tiempo",
      pesoKg: null,
      rir: 1,
      segundos: 40,
    })
  })

  it("la mejor serie mira la carga y, a igual carga, los metros solo se comparan con metros", () => {
    expect(mejorSerie(metros(32, 18), metros(32, 20))).toEqual(metros(32, 20))
    expect(mejorSerie(metros(32, 20), metros(34, 10))).toEqual(metros(34, 10))
    expect(mejorSerie(metros(null, 30), metros(null, 25))).toEqual(metros(null, 30))
    type EnUnidad = ValoresEjecutados | ValoresEjecutadosDistancia
    // 20 m no superan 10 repeticiones ni 60 s con la misma carga, ni al revés.
    expect(mejorSerie<EnUnidad>(repeticiones(32, 10), metros(32, 20))).toEqual(repeticiones(32, 10))
    expect(mejorSerie<EnUnidad>(metros(32, 20), repeticiones(32, 30))).toEqual(metros(32, 20))
    expect(mejorSerie<EnUnidad>(segundos(null, 60), metros(null, 30))).toEqual(segundos(null, 60))
    expect(mejorSerie<EnUnidad>(metros(null, 30), segundos(null, 60))).toEqual(metros(null, 30))
    // Entre repeticiones y segundos, como antes de D01.f: a igual carga, la cifra mayor.
    expect(mejorSerie(segundos(null, 40), repeticiones(null, 6))).toEqual(segundos(null, 40))
    expect(mejorSerie(repeticiones(null, 6), segundos(null, 40))).toEqual(segundos(null, 40))
    expect(mejorSerie(segundos(10, 8), repeticiones(10, 12))).toEqual(repeticiones(10, 12))
    // En la misma unidad, como siempre.
    expect(mejorSerie(repeticiones(25, 6), repeticiones(25, 8))).toEqual(repeticiones(25, 8))
    expect(mejorSerie(repeticiones(25, 6), repeticiones(20, 12))).toEqual(repeticiones(25, 6))
    expect(mejorSerie(segundos(null, 30), segundos(null, 45))).toEqual(segundos(null, 45))
  })

  it("la fuerza estimada sale solo de repeticiones con carga: ni metros ni segundos", () => {
    expect(estimar1RM(repeticiones(20, 10))).toBe(26.7)
    expect(estimar1RM(metros(32, 20))).toBeNull()
    expect(estimar1RM(metros(null, 30))).toBeNull()
    expect(estimar1RM(segundos(10, 30))).toBeNull()
    expect(estimar1RM(repeticiones(null, 10))).toBeNull()
    expect(estimar1RM(undefined)).toBeNull()
  })
})

describe("Entrega e histórico con la tercera unidad preparada (D01.f)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("distancia")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function asignar(datos: object, clienteId = entorno.ids.cliente) {
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${clienteId}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
      .expect(201)
    const id = PlanAsignadoSchema.parse(respuesta.body).sesiones[0]!.agenda.id
    return { id, base: `/entrenamiento/sesiones/${id}` }
  }

  /** Plan de siempre: 20 kg × 10 repeticiones y 30 s sin kilos, sin tipoCarga. */
  async function preparar() {
    const datos = entorno.plan()
    const [press, plancha] = datos.patron.sesiones[0]!.ejercicios[0]!.series
    const { id, base } = await asignar(datos)
    const borrador: GuardarBorrador = {
      operacionId: randomUUID(),
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro: {
        notas: null,
        series: [
          {
            serieId: press!.id,
            tipoMedicion: "repeticiones",
            pesoKg: 22.5,
            repeticiones: 8,
            hecha: true,
          },
          { serieId: plancha!.id, tipoMedicion: "tiempo", pesoKg: null, segundos: 40, hecha: true },
        ],
      },
    }
    return { id, base, borrador, datos }
  }

  // D01.g invierte el cierre de D01.f: los metros ya se pueden pautar.
  it("desde D01.g se guardan, reutilizan y publican metros, sin cantidades de otra unidad", async () => {
    const { app, como } = entorno
    /** El plan de siempre con una serie más; cada llamada, con ids y operación nuevos. */
    const conSerie = (serie: object) => {
      const datos = entorno.plan()
      const sesion = datos.patron.sesiones[0]!
      const ejercicio = sesion.ejercicios[0]!
      return {
        ...datos,
        patron: {
          sesiones: [
            {
              ...sesion,
              ejercicios: [{ ...ejercicio, series: [...ejercicio.series, serie] }],
            },
          ],
        },
      }
    }
    const pautada = { id: randomUUID(), tipoMedicion: "distancia", pesoKg: 32, metros: 20 }
    const datos = conSerie(pautada)

    // Rutina reutilizable: se guarda y se lee igual, y de ella sale el plan.
    const creada = await request(app.getHttpServer())
      .post("/entrenamiento/rutinas")
      .set(como("entrenador"))
      .send({ nombre: "Transportes", patron: datos.patron })
      .expect(201)
    const rutina = RutinaGuardadaSchema.parse(creada.body)
    const leidaRutina = await request(app.getHttpServer())
      .get(`/entrenamiento/rutinas/${rutina.id}`)
      .set(como("entrenador"))
      .expect(200)
    expect(RutinaGuardadaSchema.parse(leidaRutina.body).patron).toEqual(datos.patron)
    const { base } = await asignar({ ...datos, patron: rutina.patron })
    const leida = await request(app.getHttpServer()).get(base).set(como("cliente")).expect(200)
    expect(leida.body.prescripcion.ejercicios[0].series).toEqual(
      datos.patron.sesiones[0]!.ejercicios[0]!.series,
    )

    for (const invalida of [
      { ...pautada, repeticiones: 20 },
      { ...pautada, segundos: 20 },
      { ...pautada, metros: 0 },
      { ...pautada, metros: 12.5 },
      { ...pautada, metros: null },
    ]) {
      const otro = conSerie({ ...invalida, id: randomUUID() })
      await request(app.getHttpServer())
        .post("/entrenamiento/rutinas")
        .set(como("entrenador"))
        .send({ nombre: "No válida", patron: otro.patron })
        .expect(400)
      await request(app.getHttpServer())
        .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
        .set(como("entrenador"))
        .send(otro)
        .expect(400)
    }
  })

  it("no acepta valores de otra unidad ni hechas sin cantidad o sin la carga pautada", async () => {
    const { app, como, prisma } = entorno
    const { id, base, borrador } = await preparar()
    const [press, plancha] = borrador.registro.series
    const invalidas: object[] = [
      // Repeticiones pautadas registradas en otra unidad o con una cantidad ajena.
      { ...press, tipoMedicion: "tiempo", repeticiones: undefined, segundos: 8 },
      { ...press, tipoMedicion: "distancia", repeticiones: undefined, metros: 8 },
      { ...press, segundos: 8 },
      { ...press, metros: 8 },
      // Segundos pautados registrados como repeticiones o metros.
      { ...plancha, tipoMedicion: "repeticiones", segundos: undefined, repeticiones: 40 },
      { ...plancha, tipoMedicion: "distancia", segundos: undefined, metros: 40 },
      // El objetivo lleva kilos (documento sin tipoCarga): hecha sin peso no vale.
      { ...press, pesoKg: null },
      // Hecha sin cantidad: un vacío no es cero.
      { ...press, repeticiones: null },
    ]
    const servidor = request(app.getHttpServer())
    for (const invalida of invalidas) {
      const cuerpo = () => ({
        ...borrador,
        operacionId: randomUUID(),
        registro: { notas: null, series: [invalida, plancha] },
      })
      await servidor.put(`${base}/borrador`).set(como("cliente")).send(cuerpo()).expect(400)
      await servidor.post(`${base}/enviar`).set(como("cliente")).send(cuerpo()).expect(400)
    }
    const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({
      where: { id },
      include: { agenda: true },
    })
    expect(fila.borrador).toBeNull()
    expect(fila.resultado).toBeNull()
    expect(fila.agenda.estado).toBe("abierta")
    expect(await prisma.operacionEntrenamiento.count({ where: { sesionId: id } })).toBe(0)
    await request(app.getHttpServer())
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send(borrador)
      .expect(200)
  })

  it("un reintento devuelve el mismo resultado y la misma operación en otra unidad choca", async () => {
    const { app, como, prisma } = entorno
    const { id, base, borrador } = await preparar()
    const enviar = (cuerpo: object) =>
      request(app.getHttpServer()).post(`${base}/enviar`).set(como("cliente")).send(cuerpo)
    const primero = await enviar(borrador).expect(200)
    const resultado = ResultadoEntrenamientoSchema.parse(primero.body)
    expect((await enviar(borrador).expect(200)).body).toEqual(primero.body)
    const [press, plancha] = borrador.registro.series
    // Forma válida, pero en otra unidad: la operación ya usada responde antes de validar.
    const otraUnidad = await enviar({
      ...borrador,
      registro: {
        ...borrador.registro,
        series: [
          press,
          { ...plancha, tipoMedicion: "repeticiones", segundos: undefined, repeticiones: 40 },
        ],
      },
    }).expect(409)
    expect(otraUnidad.body.codigo).toBe("operacion_incompatible")
    const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.resultado).toEqual(resultado)
  })

  it("leer no cambia un resultado histórico; fuerza y «Anterior» solo comparan lo comparable", async () => {
    const { app, como, prisma, ids } = entorno
    const datos = entorno.plan()
    const [press, plancha] = datos.patron.sesiones[0]!.ejercicios[0]!.series
    const { id, base } = await asignar(datos, ids.otro)
    const leida = await request(app.getHttpServer()).get(base).set(como("entrenador")).expect(200)
    // Enviado antes del RIR y del cronómetro: sin `rir`, `checkin` ni tiempo activo.
    const historico = {
      sesionId: id,
      prescripcion: leida.body.prescripcion,
      revisionPrescripcion: 0,
      enviadoEn: "2026-09-14T10:00:00.000Z",
      notas: null,
      series: [
        {
          serieId: press!.id,
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
        },
        {
          serieId: plancha!.id,
          hecha: true,
          valores: { tipoMedicion: "tiempo", pesoKg: 5, segundos: 30 },
        },
      ],
    }
    expect(ResultadoEntrenamientoSchema.parse(historico)).toEqual(historico)
    await prisma.sesionEntrenamiento.update({
      where: { id },
      data: { iniciada: true, resultado: historico, enviadoEn: new Date(historico.enviadoEn) },
    })

    const resultado = await request(app.getHttpServer())
      .get(`${base}/resultado`)
      .set(como("entrenador"))
      .expect(200)
    expect(resultado.body).toEqual(historico)
    const ficha = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.otro}/resultados`)
      .set(como("entrenador"))
      .expect(200)
    expect(ficha.body.resultados).toHaveLength(1)
    expect(ficha.body.resultados[0].resultado).toEqual(historico)
    // Los 5 kg de la plancha no estiman fuerza: solo cuenta 20 kg × 10.
    const fuerza = await request(app.getHttpServer())
      .get(`/entrenamiento/clientes/${ids.otro}/fuerza`)
      .set(como("entrenador"))
      .expect(200)
    expect(fuerza.body.ejercicios).toEqual([
      {
        ejercicioId: ids.ejercicio,
        nombre: expect.any(String),
        puntos: [{ fecha: expect.any(String), pesoKg: 20, repeticiones: 10, estimado: 26.7 }],
      },
    ])
    const siguiente = await asignar(entorno.plan(), ids.otro)
    const anteriores = await request(app.getHttpServer())
      .get(`${siguiente.base}/anteriores`)
      .set(como("entrenador"))
      .expect(200)
    expect(anteriores.body.anteriores).toEqual([
      {
        ejercicioId: ids.ejercicio,
        fecha: historico.enviadoEn,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
      },
    ])
    const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.resultado).toEqual(historico)
  })

  // Preparados en D01.f y activos desde D01.g: el recorrido completo en metros.
  describe("metros de la pauta al resultado (D01.g)", () => {
    async function catalogo(nombre: string): Promise<string> {
      const normalizado = `e2e-entrenamiento-distancia-${nombre}`
      const fila = await entorno.prisma.ejercicio.upsert({
        where: { nombreNormalizado: normalizado },
        update: {},
        create: {
          nombre: normalizado,
          nombreNormalizado: normalizado,
          grupoPrincipal: "antebrazos",
          instrucciones: "Prueba de integración",
        },
      })
      return fila.id
    }

    /** Press de siempre, un transporte con carga (2 × 20 m, 32 kg) y zancadas sin carga (30 m). */
    async function planConMetros() {
      const datos = entorno.plan()
      const sesion = datos.patron.sesiones[0]!
      const press = sesion.ejercicios[0]!
      const transporte = {
        id: randomUUID(),
        ejercicioId: await catalogo("transporte"),
        indicaciones: null,
        tipoCarga: "conCargaExterna" as const,
        series: [0, 1].map(() => ({
          id: randomUUID(),
          tipoMedicion: "distancia" as const,
          pesoKg: 32,
          metros: 20,
        })),
      }
      const zancadas = {
        id: randomUUID(),
        ejercicioId: await catalogo("zancadas"),
        indicaciones: null,
        tipoCarga: "sinCarga" as const,
        series: [
          { id: randomUUID(), tipoMedicion: "distancia" as const, pesoKg: null, metros: 30 },
        ],
      }
      const plan = {
        ...datos,
        patron: { sesiones: [{ ...sesion, ejercicios: [press, transporte, zancadas] }] },
      }
      const { id, base } = await asignar(plan)
      const registro = {
        notas: null,
        series: [
          {
            serieId: press.series[0]!.id,
            tipoMedicion: "repeticiones",
            pesoKg: 20,
            repeticiones: 10,
            hecha: true,
          },
          {
            serieId: transporte.series[0]!.id,
            tipoMedicion: "distancia",
            pesoKg: 34,
            metros: 18,
            rir: 1,
            hecha: true,
          },
          {
            serieId: transporte.series[1]!.id,
            tipoMedicion: "distancia",
            pesoKg: null,
            metros: null,
            hecha: false,
          },
          {
            serieId: zancadas.series[0]!.id,
            tipoMedicion: "distancia",
            pesoKg: null,
            metros: 30,
            hecha: true,
          },
        ],
      }
      return { id, base, plan, press, transporte, zancadas, registro }
    }

    it("pauta, guarda, envía y lee metros con su carga, sin convertirlos", async () => {
      const { app, como, ids } = entorno
      const { base, press, transporte, zancadas, registro } = await planConMetros()
      const leida = await request(app.getHttpServer()).get(base).set(como("cliente")).expect(200)
      expect(leida.body.prescripcion.ejercicios[1].series[0]).toEqual(transporte.series[0])
      expect(leida.body.prescripcion.ejercicios[2].series[0]).toEqual(zancadas.series[0])

      const guardar = { operacionId: randomUUID(), revisionPrescripcion: 0, revisionBorrador: 0 }
      const guardado = await request(app.getHttpServer())
        .put(`${base}/borrador`)
        .set(como("cliente"))
        .send({ ...guardar, registro })
        .expect(200)
      expect(guardado.body.registro.series).toEqual(registro.series)
      const repetido = await request(app.getHttpServer())
        .put(`${base}/borrador`)
        .set(como("cliente"))
        .send({ ...guardar, registro })
        .expect(200)
      expect(repetido.body).toEqual(guardado.body)

      const envio = {
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 1,
        registro: {
          ...registro,
          series: registro.series.map((serie, n) =>
            n === 2 ? { ...serie, omitida: true } : serie,
          ),
        },
      }
      const enviar = (cuerpo: object) =>
        request(app.getHttpServer()).post(`${base}/enviar`).set(como("cliente")).send(cuerpo)
      const enviado = await enviar(envio).expect(200)
      const series = new Map(
        (enviado.body.series as Array<{ serieId: string }>).map((s) => [s.serieId, s]),
      )
      expect(series.get(transporte.series[0]!.id)).toEqual({
        serieId: transporte.series[0]!.id,
        hecha: true,
        valores: { tipoMedicion: "distancia", pesoKg: 34, metros: 18, rir: 1 },
      })
      expect(series.get(transporte.series[1]!.id)).toEqual({
        serieId: transporte.series[1]!.id,
        hecha: false,
        omitida: true,
      })
      expect(series.get(zancadas.series[0]!.id)).toEqual({
        serieId: zancadas.series[0]!.id,
        hecha: true,
        valores: { tipoMedicion: "distancia", pesoKg: null, metros: 30, rir: null },
      })
      expect(series.get(press.series[0]!.id)).toMatchObject({
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
      })
      expect((await enviar(envio).expect(200)).body).toEqual(enviado.body)
      await enviar({
        ...envio,
        registro: {
          ...envio.registro,
          series: envio.registro.series.map((serie, n) =>
            n === 1
              ? { ...serie, tipoMedicion: "repeticiones", metros: undefined, repeticiones: 18 }
              : serie,
          ),
        },
      }).expect(409)

      // Lectura profesional: el mismo documento, en metros.
      const resultado = await request(app.getHttpServer())
        .get(`${base}/resultado`)
        .set(como("entrenador"))
        .expect(200)
      expect(resultado.body).toEqual(enviado.body)
      const ficha = await request(app.getHttpServer())
        .get(`/entrenamiento/clientes/${ids.cliente}/resultados`)
        .set(como("entrenador"))
        .expect(200)
      expect(
        (ficha.body.resultados as Array<{ resultado: { sesionId: string } }>).find(
          (r) => r.resultado.sesionId === enviado.body.sesionId,
        )?.resultado,
      ).toEqual(enviado.body)
      const fuerza = await request(app.getHttpServer())
        .get(`/entrenamiento/clientes/${ids.cliente}/fuerza`)
        .set(como("entrenador"))
        .expect(200)
      const conFuerza = (fuerza.body.ejercicios as Array<{ ejercicioId: string }>).map(
        (e) => e.ejercicioId,
      )
      expect(conFuerza).toContain(ids.ejercicio)
      expect(conFuerza).not.toContain(transporte.ejercicioId)
      expect(conFuerza).not.toContain(zancadas.ejercicioId)

      const siguiente = await planConMetros()
      const anteriores = await request(app.getHttpServer())
        .get(`${siguiente.base}/anteriores`)
        .set(como("cliente"))
        .expect(200)
      const porEjercicio = new Map(
        (anteriores.body.anteriores as Array<{ ejercicioId: string; valores: object }>).map((a) => [
          a.ejercicioId,
          a.valores,
        ]),
      )
      expect(porEjercicio.get(transporte.ejercicioId)).toEqual({
        tipoMedicion: "distancia",
        pesoKg: 34,
        metros: 18,
        rir: 1,
      })
      expect(porEjercicio.get(zancadas.ejercicioId)).toEqual({
        tipoMedicion: "distancia",
        pesoKg: null,
        metros: 30,
        rir: null,
      })
    })

    it("rechaza otra unidad, cantidades no válidas y la carga que no toca", async () => {
      const { app, como, prisma } = entorno
      const { id, base, registro } = await planConMetros()
      const [press, transporte, , zancadas] = registro.series
      const invalidas: object[] = [
        { ...transporte, tipoMedicion: "repeticiones", metros: undefined, repeticiones: 18 },
        { ...transporte, tipoMedicion: "tiempo", metros: undefined, segundos: 18 },
        { ...transporte, repeticiones: 18 },
        { ...transporte, metros: 0 },
        { ...transporte, metros: 12.5 },
        { ...transporte, metros: null },
        // Con carga externa, «Hecha» exige el peso real; sin carga, no admite kilos.
        { ...transporte, pesoKg: null },
        { ...zancadas, pesoKg: 10 },
        { ...press, tipoMedicion: "distancia", repeticiones: undefined, metros: 10 },
      ]
      for (const invalida of invalidas) {
        await request(app.getHttpServer())
          .put(`${base}/borrador`)
          .set(como("cliente"))
          .send({
            operacionId: randomUUID(),
            revisionPrescripcion: 0,
            revisionBorrador: 0,
            registro: { notas: null, series: [invalida] },
          })
          .expect(400)
      }
      const fila = await prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
      expect(fila.borrador).toBeNull()
    })

    it("tras cambiar la pauta a metros, la copia vieja choca y otra unidad no entra", async () => {
      const { app, como } = entorno
      const { base, borrador, datos } = await preparar()
      const sesion = datos.patron.sesiones[0]!
      const ejercicio = sesion.ejercicios[0]!
      const [press, plancha] = ejercicio.series
      const ajustada = await request(app.getHttpServer())
        .patch(`${base}/prescripcion`)
        .set(como("entrenador"))
        .send({
          revisionPrescripcion: 0,
          nombre: sesion.nombre,
          ejercicios: [
            {
              ...ejercicio,
              series: [
                { id: press!.id, tipoMedicion: "distancia", pesoKg: 20, metros: 20 },
                plancha,
              ],
            },
          ],
        })
        .expect(200)
      expect(ajustada.body.revisionPrescripcion).toBe(1)
      const guardar = (cuerpo: object) =>
        request(app.getHttpServer()).put(`${base}/borrador`).set(como("cliente")).send(cuerpo)
      const vieja = await guardar(borrador).expect(409)
      expect(vieja.body.codigo).toBe("revision_obsoleta")
      await guardar({ ...borrador, operacionId: randomUUID(), revisionPrescripcion: 1 }).expect(400)
      const [, segundosPlancha] = borrador.registro.series
      await guardar({
        ...borrador,
        operacionId: randomUUID(),
        revisionPrescripcion: 1,
        registro: {
          notas: null,
          series: [
            {
              serieId: press!.id,
              tipoMedicion: "distancia",
              pesoKg: 20,
              metros: 18,
              hecha: true,
            },
            segundosPlancha,
          ],
        },
      }).expect(200)
    })
  })
})
