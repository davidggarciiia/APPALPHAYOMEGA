import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import request from "supertest"
import {
  PlanAsignadoSchema,
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  ResumenSemanalSchema,
  type Prescripcion,
  type ResumenSemanal,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Resumen semanal agregado del entrenador", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const clientes: string[] = []
  let accesorioId: string
  let sesiones: {
    id: string
    clienteId: string
    fecha: string
    resultado: Prisma.InputJsonObject
  }[]

  const fecha = (dias: number) =>
    new Date(Date.parse("2026-09-07T00:00:00Z") + dias * 86400000).toISOString().slice(0, 10)

  function prescripcion(pesoKg: number): Prescripcion {
    const repeticiones = (peso: number, reps = 6) => ({
      id: randomUUID(),
      tipoMedicion: "repeticiones",
      pesoKg: peso,
      repeticiones: reps,
    })
    return PrescripcionSchema.parse({
      nombre: "Fuerza",
      ejercicios: [
        {
          id: randomUUID(),
          ejercicioId: entorno.ids.ejercicio,
          nombre: "Compuesto",
          indicaciones: null,
          compuesto: true,
          series: [
            repeticiones(pesoKg),
            repeticiones(pesoKg - 2.5, 20),
            repeticiones(900),
            { id: randomUUID(), tipoMedicion: "tiempo", pesoKg: 950, segundos: 90 },
            { id: randomUUID(), tipoMedicion: "distancia", pesoKg: 950, metros: 100 },
          ],
        },
        {
          id: randomUUID(),
          ejercicioId: accesorioId,
          nombre: "Accesorio",
          indicaciones: null,
          seccion: "principal",
          compuesto: false,
          series: [repeticiones(400)],
        },
        ...(["calentamiento", "circuito", "final"] as const).map((seccion) => ({
          id: randomUUID(),
          ejercicioId: entorno.ids.ejercicio,
          nombre: seccion,
          indicaciones: null,
          seccion,
          compuesto: true,
          series: [repeticiones(500)],
        })),
      ],
    })
  }

  async function resumen(semana = "2026-10-26"): Promise<ResumenSemanal> {
    return ResumenSemanalSchema.parse(
      (
        await request(entorno.app.getHttpServer())
          .get(`/entrenamiento/resumen-semanal?semana=${semana}`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
  }

  function delCliente(datos: ResumenSemanal, clienteId = entorno.ids.cliente!) {
    const cliente = datos.clientes.find((c) => c.clienteId === clienteId)
    expect(cliente).toBeDefined()
    return cliente!
  }

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("resumen-semanal")
    const { prisma, ids } = entorno
    clientes.push(ids.cliente!, ids.otro!, ...Array.from({ length: 13 }, () => randomUUID()))
    await prisma.usuario.createMany({
      data: clientes.slice(2).map((id, n) => ({
        id,
        nombre: `Cliente ${n}`,
        apellidos: "Resumen",
        rol: "cliente",
        estado: "activo",
        email: `${id}@e2e-entrenamiento-resumen-semanal.test`,
      })),
    })
    accesorioId = (
      await prisma.ejercicio.create({
        data: {
          nombre: "e2e-entrenamiento-resumen-semanal accesorio",
          nombreNormalizado: "e2e-entrenamiento-resumen-semanal accesorio",
          grupoPrincipal: "biceps",
          instrucciones: "Prueba del agregado",
        },
      })
    ).id

    sesiones = []
    const planes: Prisma.PlanEntrenamientoCreateManyInput[] = []
    const agendas: Prisma.SesionProgramadaCreateManyInput[] = []
    const entrenamientos: Prisma.SesionEntrenamientoCreateManyInput[] = []
    const referencias: Prisma.ReferenciaEjercicioCreateManyInput[] = []
    for (const clienteId of clientes) {
      const planId = randomUUID()
      const delPlan = []
      for (let semana = 0; semana < 8; semana++) {
        for (const [n, dia] of [0, 2, 6].entries()) {
          const id = randomUUID()
          const diaActual = fecha(semana * 7 + dia)
          const prescrita = prescripcion(40 + semana * 5 + n * 2.5)
          const resultado = ResultadoEntrenamientoSchema.parse({
            sesionId: id,
            prescripcion: prescrita,
            revisionPrescripcion: 0,
            enviadoEn: "2026-11-03T12:00:00.000Z",
            notas: null,
            series: prescrita.ejercicios.flatMap((e, indice) =>
              e.series.map((s, serie) => {
                if (indice === 0 && serie === 2)
                  return { serieId: s.id, hecha: false, omitida: true }
                const { id: serieId, ...valores } = s
                return { serieId, hecha: true, valores: { ...valores, rir: null } }
              }),
            ),
          })
          sesiones.push({ id, clienteId, fecha: diaActual, resultado })
          agendas.push({
            id,
            clienteId,
            fechaOriginal: new Date(`${diaActual}T00:00:00Z`),
            fechaActual: new Date(`${diaActual}T00:00:00Z`),
            estado: "cerrada",
          })
          entrenamientos.push({
            id,
            clienteId,
            planId,
            prescripcion: prescrita,
            resultado,
            iniciada: true,
            enviadoEn: new Date(resultado.enviadoEn),
          })
          referencias.push(
            ...prescrita.ejercicios.map((e) => ({
              sesionId: id,
              idPrescrito: e.id,
              ejercicioId: e.ejercicioId,
            })),
          )
          delPlan.push({
            agenda: {
              id,
              clienteId,
              fechaOriginal: diaActual,
              fechaActual: diaActual,
              estado: "cerrada",
              revision: 0,
            },
            nombre: "Fuerza",
            enviadoEn: resultado.enviadoEn,
          })
        }
      }
      planes.push({
        id: planId,
        clienteId,
        creadorId: ids.entrenador!,
        operacionId: randomUUID(),
        hashPeticion: "fixture-resumen-semanal",
        nombre: "Ocho semanas",
        semanaInicial: new Date("2026-09-07"),
        semanas: 8,
        patron: entorno.plan().patron,
        respuesta: PlanAsignadoSchema.parse({
          id: planId,
          operacionId: randomUUID(),
          sesiones: delPlan,
        }),
      })
    }
    await prisma.planEntrenamiento.createMany({ data: planes })
    await prisma.sesionProgramada.createMany({ data: agendas })
    await prisma.sesionEntrenamiento.createMany({ data: entrenamientos })
    await prisma.referenciaEjercicio.createMany({ data: referencias })
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("responde en menos de 500 ms al primer acceso con 15 clientes y 8 semanas de datos", async () => {
    expect(sesiones).toHaveLength(15 * 8 * 3)
    const inicio = performance.now()
    const respuesta = await request(entorno.app.getHttpServer())
      .get("/entrenamiento/resumen-semanal?semana=2026-10-26")
      .set(entorno.como("entrenador"))
      .expect(200)
    const duracion = performance.now() - inicio
    const datos = ResumenSemanalSchema.parse(respuesta.body)
    expect(duracion).toBeLessThan(500)
    expect(datos.clientes.filter((c) => clientes.includes(c.clienteId))).toHaveLength(15)
    for (const excluido of [
      entorno.ids.pendiente,
      entorno.ids.desactivado,
      entorno.ids.entrenador,
    ]) {
      expect(datos.clientes.map((c) => c.clienteId)).not.toContain(excluido)
    }
    console.info(`Resumen semanal · 15 clientes × 8 semanas: ${duracion.toFixed(1)} ms`)
  })

  it("cuenta por fecha actual de agenda y compara la mejor fuerza de E1, incluso con RIR nulo", async () => {
    const cliente = delCliente(await resumen())
    expect(cliente).toMatchObject({
      sesionesPrevistas: 3,
      sesionesEnviadas: 3,
      ultimaFechaEnviada: "2026-11-01",
    })
    expect(cliente.ejercicios).toHaveLength(1)
    expect(cliente.ejercicios[0]).toMatchObject({
      ejercicioId: entorno.ids.ejercicio,
      mejorSerie: { fecha: "2026-11-01", pesoKg: 80, repeticiones: 6, rir: null, estimado1RM: 96 },
      mejorSerieAnterior: { fecha: "2026-10-25", pesoKg: 75, repeticiones: 6, estimado1RM: 90 },
      comparacion: {
        direccion: "sube",
        diferenciaKg: 5,
        diferenciaRepeticiones: 0,
        diferencia1RM: 6,
      },
      estado: "Progresa",
      sesionesConMarca: 24,
      record: true,
    })
    const anterior = delCliente(await resumen("2026-10-19"))
    expect(anterior.sesionesEnviadas).toBe(3)
    expect(anterior.ultimaFechaEnviada).toBe("2026-10-25")
    expect(anterior.ejercicios[0]?.sesionesConMarca).toBe(21)
    expect(anterior.ejercicios[0]?.mejorSerie?.fecha).toBe("2026-10-25")
  })

  it("sin historial no inventa diferencias y la primera marca cuenta como récord", async () => {
    const primera = delCliente(await resumen("2026-09-07"))
    expect(primera.ejercicios[0]).toMatchObject({
      mejorSerie: { fecha: "2026-09-13", pesoKg: 45 },
      mejorSerieAnterior: null,
      comparacion: null,
      record: true,
    })
    const vacio = delCliente(await resumen("2026-08-31"))
    expect(vacio).toMatchObject({
      sesionesPrevistas: 0,
      sesionesEnviadas: 0,
      ultimaFechaEnviada: null,
      ejercicios: [],
      molestiasAbiertas: [],
    })
  })

  it("conserva el último envío de hace más de una semana sin inventar marcas actuales", async () => {
    const cliente = delCliente(await resumen("2026-11-09"))
    expect(cliente).toMatchObject({
      sesionesPrevistas: 0,
      sesionesEnviadas: 0,
      ultimaFechaEnviada: "2026-11-01",
      ejercicios: [],
    })
  })

  it("un récord antiguo impide anunciar otro aunque mejore respecto a la semana anterior", async () => {
    const anterior = sesiones.find(
      (s) => s.clienteId === entorno.ids.otro && s.fecha === "2026-09-07",
    )!
    const resultado = ResultadoEntrenamientoSchema.parse(anterior.resultado)
    const primera = resultado.series[0]!
    if (!primera.hecha) throw new Error("La fixture necesita una serie hecha")
    primera.valores.pesoKg = 100
    await entorno.prisma.sesionEntrenamiento.update({
      where: { id: anterior.id },
      data: { resultado: ResultadoEntrenamientoSchema.parse(resultado) },
    })
    const ejercicio = delCliente(await resumen(), entorno.ids.otro!).ejercicios[0]
    expect(ejercicio).toMatchObject({ comparacion: { direccion: "sube" }, record: false })
  })

  it("mantiene privado un borrador HTTP y solo suma su resultado al enviarlo", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    const datos = entorno.plan()
    datos.semanaInicial = "2026-12-07"
    const ejercicio = datos.patron.sesiones[0]!.ejercicios[0]!
    ejercicio.compuesto = true
    ejercicio.series = [
      { id: randomUUID(), tipoMedicion: "repeticiones", pesoKg: 90, repeticiones: 6 },
    ]
    const asignado = PlanAsignadoSchema.parse(
      (
        await request(http)
          .post(`/entrenamiento/clientes/${ids.cliente}/planes`)
          .set(como("entrenador"))
          .send(datos)
          .expect(201)
      ).body,
    )
    const sesionId = asignado.sesiones[0]!.agenda.id
    const base = `/entrenamiento/sesiones/${sesionId}`
    const antes = delCliente(await resumen("2026-12-07"))
    expect(antes).toMatchObject({
      sesionesPrevistas: 1,
      sesionesEnviadas: 0,
      ultimaFechaEnviada: "2026-11-01",
      ejercicios: [],
    })
    const registro = {
      notas: "NOTA PRIVADA DEL BORRADOR",
      series: [
        {
          serieId: ejercicio.series[0]!.id,
          tipoMedicion: "repeticiones",
          pesoKg: 900,
          repeticiones: 10,
          hecha: true,
          rir: 2,
        },
      ],
    }
    await request(http)
      .put(`${base}/borrador`)
      .set(como("cliente"))
      .send({ operacionId: randomUUID(), revisionPrescripcion: 0, revisionBorrador: 0, registro })
      .expect(200)
    const borrador = await resumen("2026-12-07")
    expect(delCliente(borrador)).toEqual(antes)
    expect(JSON.stringify(borrador)).not.toContain("NOTA PRIVADA")
    expect(JSON.stringify(borrador)).not.toContain('"pesoKg":900')

    const molestia = await request(http)
      .post(`${base}/molestias`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        ejercicioPrescritoId: null,
        serie: null,
        zona: "hombro",
        intensidad: 7,
        sintomas: [],
        nota: null,
      })
      .expect(201)
    expect(delCliente(await resumen("2026-12-07")).molestiasAbiertas).toEqual([
      expect.objectContaining({ id: molestia.body.id, sesionId, zona: "hombro", intensidad: 7 }),
    ])
    expect(delCliente(await resumen("2026-09-07")).molestiasAbiertas).toEqual([])
    await request(http)
      .post(`/entrenamiento/molestias/${molestia.body.id}/atender`)
      .set(como("entrenador"))
      .send({ respuesta: "Atendida" })
      .expect(200)
    expect(delCliente(await resumen("2026-12-07")).molestiasAbiertas).toEqual([])

    await request(http)
      .post(`${base}/enviar`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 1,
        registro: {
          ...registro,
          notas: null,
          series: [{ ...registro.series[0]!, pesoKg: 90, repeticiones: 6 }],
        },
      })
      .expect(200)
    const enviada = delCliente(await resumen("2026-12-07"))
    expect(enviada).toMatchObject({
      sesionesPrevistas: 1,
      sesionesEnviadas: 1,
      ultimaFechaEnviada: "2026-12-07",
    })
    expect(enviada.ejercicios[0]).toMatchObject({
      mejorSerie: { pesoKg: 90 },
      sesionesConMarca: 25,
      record: true,
    })
  })

  it("exige sesión de entrenador y una consulta de semana válida", async () => {
    const http = entorno.app.getHttpServer()
    const ruta = "/entrenamiento/resumen-semanal?semana=2026-10-26"
    await request(http).get(ruta).expect(401)
    for (const rol of ["cliente", "nutricionista", "empleado"]) {
      await request(http).get(ruta).set(entorno.como(rol)).expect(403)
    }
    for (const consulta of [
      "",
      "?semana=2026-10-27",
      "?semana=2026-02-30",
      "?semana=2026-10-26&clienteId=ajeno",
    ]) {
      await request(http)
        .get(`/entrenamiento/resumen-semanal${consulta}`)
        .set(entorno.como("entrenador"))
        .expect(400)
    }
  })
})
