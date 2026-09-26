import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  PanelHoySchema,
  PlanAsignadoSchema,
  VERSION_CONSENTIMIENTO,
  type AsignarPlan,
  type PanelHoy,
} from "@alpha-omega/shared"

import { fechaSql, lunesDeSemana, sumarDias } from "../src/agenda/fechas.js"
import { hoyEnAgenda } from "../src/panel/panel.service.js"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { darConsentimiento } from "./valoraciones-ayuda.js"

/**
 * El panel agrega toda la cartera (premisa de entrenador único), así que las
 * cifras se comprueban como diferencia con lo que había antes de crear los
 * datos de la prueba, y las listas, buscando lo creado aquí.
 */
describe("Panel «Hoy» del entrenador", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const hoy = hoyEnAgenda(new Date())
  const lunes = lunesDeSemana(hoy)
  const domingo = sumarDias(lunes, 6)
  /** El domingo, si todavía no ha llegado: una sesión que queda por delante. */
  const futura = hoy === domingo ? null : domingo
  const diaSemana = (fecha: string): number => ((fechaSql(fecha).getUTCDay() + 6) % 7) + 1

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("panel")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  async function panel(
    como: { Authorization: string } = entorno.como("entrenador"),
  ): Promise<PanelHoy> {
    const respuesta = await request(entorno.app.getHttpServer())
      .get("/panel/hoy")
      .set(como)
      .expect(200)
    return PanelHoySchema.parse(respuesta.body)
  }

  /** Un plan de una semana con una sesión por cada día pedido. */
  function plan(sesiones: Array<{ nombre: string; fecha: string }>): AsignarPlan {
    return {
      operacionId: randomUUID(),
      nombre: "Plan del panel",
      semanaInicial: lunes,
      semanas: 1,
      patron: {
        sesiones: sesiones.map((sesion) => ({
          id: randomUUID(),
          nombre: sesion.nombre,
          diaSemana: diaSemana(sesion.fecha),
          ejercicios: [
            {
              id: randomUUID(),
              ejercicioId: entorno.ids.ejercicio!,
              indicaciones: null,
              series: [
                { id: randomUUID(), tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
              ],
            },
          ],
        })),
      },
    }
  }

  /** Asigna el plan y devuelve el id de cada sesión por su nombre, y la serie de cada una. */
  async function asignar(
    clave: string,
    sesiones: Array<{ nombre: string; fecha: string }>,
  ): Promise<Record<string, { id: string; serieId: string }>> {
    const datos = plan(sesiones)
    const respuesta = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids[clave]}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
      .expect(201)
    const asignado = PlanAsignadoSchema.parse(respuesta.body)
    return Object.fromEntries(
      asignado.sesiones.map((sesion) => {
        const patron = datos.patron.sesiones.find((s) => s.nombre === sesion.nombre)!
        return [
          sesion.nombre,
          { id: sesion.agenda.id, serieId: patron.ejercicios[0]!.series[0]!.id },
        ]
      }),
    )
  }

  async function enviar(
    clave: string,
    sesion: { id: string; serieId: string },
    esfuerzo: number | null,
  ): Promise<void> {
    await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/sesiones/${sesion.id}/enviar`)
      .set(entorno.como(clave))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          series: [
            {
              serieId: sesion.serieId,
              tipoMedicion: "repeticiones",
              pesoKg: 20,
              repeticiones: 10,
              hecha: true,
            },
          ],
          ...(esfuerzo !== null && { cierre: { esfuerzo, energia: 4, incomodo: false } }),
        },
      })
      .expect(200)
  }

  it("solo lo abre el entrenador y exige sesión", async () => {
    const { app, como } = entorno
    await request(app.getHttpServer()).get("/panel/hoy").expect(401)
    for (const rol of ["cliente", "nutricionista", "empleado"])
      await request(app.getHttpServer()).get("/panel/hoy").set(como(rol)).expect(403)
  })

  let empuje: { id: string; serieId: string }
  let comentarioId: string

  it("cuenta la cartera, hoy, lo pendiente de revisar, la semana y la actividad", async () => {
    const { app, como, ids, prisma } = entorno
    const antes = await panel()

    const deCliente = await asignar("cliente", [
      { nombre: "Empuje", fecha: hoy },
      { nombre: "Tirón", fecha: hoy },
      ...(futura ? [{ nombre: "Pierna", fecha: futura }] : []),
    ])
    const deOtro = await asignar("otro", [{ nombre: "Core", fecha: hoy }])
    const dePendiente = await asignar("pendiente", [{ nombre: "Movilidad", fecha: hoy }])
    // Una baja no aparece aunque tenga sesiones: se le asignan antes de darla de baja.
    await prisma.usuario.update({ where: { id: ids.desactivado }, data: { estado: "activo" } })
    const deBaja = await asignar("desactivado", [{ nombre: "Oculta", fecha: hoy }])
    await prisma.usuario.update({
      where: { id: ids.desactivado },
      data: { estado: "desactivado" },
    })
    empuje = deCliente.Empuje!
    const tiron = deCliente["Tirón"]!
    const core = deOtro.Core!

    await enviar("cliente", empuje, 8)
    await request(app.getHttpServer())
      .put(`/entrenamiento/sesiones/${tiron.id}/borrador`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: { notas: null, series: [] },
      })
      .expect(200)
    const molestia = await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${tiron.id}/molestias`)
      .set(como("cliente"))
      .send({
        operacionId: randomUUID(),
        ejercicioPrescritoId: null,
        serie: null,
        zona: "hombro",
        intensidad: 5,
        sintomas: [],
        nota: null,
      })
      .expect(201)
    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${empuje.id}/comentarios`)
      .set(como("cliente"))
      .send({ operacionId: randomUUID(), ejercicioPrescritoId: null, texto: "Me costó la última" })
      .expect(201)
    // Enviada y ya revisada: está en hoy y en la actividad, no en «Por revisar».
    await enviar("otro", core, null)
    await request(app.getHttpServer())
      .put(`/entrenamiento/sesiones/${core.id}/revision`)
      .set(como("entrenador"))
      .expect(200)

    const solicitud = await prisma.solicitudFotos.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        vistas: ["frente"],
        estado: "recibida",
        recibidaEn: new Date(),
      },
    })
    await prisma.medioFoto.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.otro!,
        operacionId: randomUUID(),
        origen: "cliente",
        vista: "frente",
        fechaToma: fechaSql(hoy),
        estado: "disponible",
        confirmadoEn: new Date(),
        tipoMime: "image/jpeg",
        bytes: 1000,
        clave: `clientes/${ids.otro}/${randomUUID()}.jpg`,
        subidaCaducaEn: new Date(),
        solicitudId: solicitud.id,
      },
    })
    const medidaPropia = await prisma.medidaCorporal.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.otro!,
        operacionId: randomUUID(),
        fecha: fechaSql(hoy),
        pesoKg: 70,
      },
    })
    // La que toma el entrenador no es actividad del cliente.
    const medidaDelEntrenador = await prisma.medidaCorporal.create({
      data: {
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        operacionId: randomUUID(),
        fecha: fechaSql(hoy),
        cinturaCm: 80,
      },
    })

    const despues = await panel()
    const contar = (estado: "activo" | "pendiente" | "desactivado"): Promise<number> =>
      prisma.usuario.count({ where: { rol: "cliente", estado } })
    const [activos, pendientes, bajas] = await Promise.all([
      contar("activo"),
      contar("pendiente"),
      contar("desactivado"),
    ])
    expect(despues.fecha).toBe(hoy)
    expect(despues.clientes).toMatchObject({
      activos,
      pendientes,
      bajas,
      total: activos + pendientes + bajas,
    })

    const nombre = (clave: string): { id: string; nombre: string } => ({
      id: ids[clave]!,
      nombre: clave,
    })
    expect(despues.hoy.total).toBe(antes.hoy.total + 4)
    expect(despues.hoy.enviadas).toBe(antes.hoy.enviadas + 2)
    expect(despues.hoy.enCurso).toBe(antes.hoy.enCurso + 1)
    expect(despues.hoy.sesiones).toEqual(
      expect.arrayContaining([
        {
          sesionId: empuje.id,
          cliente: nombre("cliente"),
          sesion: "Empuje",
          estado: "enviada",
          enviadoEn: expect.any(String),
        },
        {
          sesionId: tiron.id,
          cliente: nombre("cliente"),
          sesion: "Tirón",
          estado: "enCurso",
          enviadoEn: null,
        },
        expect.objectContaining({ sesionId: core.id, estado: "enviada" }),
        expect.objectContaining({
          sesionId: dePendiente.Movilidad!.id,
          cliente: nombre("pendiente"),
          estado: "pendiente",
        }),
      ]),
    )
    expect(despues.hoy.sesiones.map((s) => s.sesionId)).not.toContain(deBaja.Oculta!.id)

    const { entrenamientos, molestias, fotos, comentarios } = despues.porRevisar
    expect(entrenamientos.total).toBe(antes.porRevisar.entrenamientos.total + 1)
    expect(entrenamientos.elementos[0]).toEqual({
      sesionId: empuje.id,
      cliente: nombre("cliente"),
      sesion: "Empuje",
      fecha: hoy,
      enviadoEn: expect.any(String),
      esfuerzo: 8,
    })
    expect(entrenamientos.elementos.map((e) => e.sesionId)).not.toContain(core.id)
    expect(molestias.total).toBe(antes.porRevisar.molestias.total + 1)
    expect(molestias.elementos[0]).toEqual({
      id: molestia.body.id,
      sesionId: tiron.id,
      cliente: nombre("cliente"),
      zona: "hombro",
      intensidad: 5,
      nivel: "ambar",
      ejercicio: null,
      creadaEn: expect.any(String),
    })
    expect(fotos.total).toBe(antes.porRevisar.fotos.total + 1)
    expect(fotos.elementos[0]).toEqual({
      solicitudId: solicitud.id,
      cliente: nombre("otro"),
      fotos: 1,
      recibidaEn: solicitud.recibidaEn!.toISOString(),
    })
    expect(comentarios.total).toBe(antes.porRevisar.comentarios.total + 1)
    expect(comentarios.elementos[0]).toMatchObject({
      sesionId: empuje.id,
      cliente: nombre("cliente"),
      sesion: "Empuje",
    })
    comentarioId = comentarios.elementos[0]!.novedadId

    // De lunes a hoy: Empuje, Tirón, Core y Movilidad; la baja no cuenta.
    expect(despues.semana).toMatchObject({
      lunes,
      domingo,
      programadas: antes.semana.programadas + 4,
      enviadas: antes.semana.enviadas + 2,
      restantes: antes.semana.restantes + (futura ? 1 : 0),
      adherencia: Math.floor(((antes.semana.enviadas + 2) / (antes.semana.programadas + 4)) * 100),
    })
    expect(despues.semana.menorAdherencia).toEqual(
      expect.arrayContaining([
        { cliente: nombre("pendiente"), programadas: 1, enviadas: 0, adherencia: 0 },
        { cliente: nombre("cliente"), programadas: 2, enviadas: 1, adherencia: 50 },
      ]),
    )
    // Quien lo ha enviado todo no es de los que menos.
    expect(despues.semana.menorAdherencia.map((c) => c.cliente.id)).not.toContain(ids.otro)
    const porcentajes = despues.semana.menorAdherencia.map((c) => c.adherencia)
    expect(porcentajes).toEqual([...porcentajes].sort((a, b) => a - b))

    expect(despues.actividad).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: "envio", sesionId: empuje.id, sesion: "Empuje" }),
        expect.objectContaining({ tipo: "envio", sesionId: core.id, cliente: nombre("otro") }),
        expect.objectContaining({
          tipo: "molestia",
          id: molestia.body.id,
          zona: "hombro",
          nivel: "ambar",
        }),
        expect.objectContaining({ tipo: "fotos", id: solicitud.id, fotos: 1 }),
        {
          tipo: "medida",
          id: medidaPropia.id,
          cliente: nombre("otro"),
          fecha: medidaPropia.creadoEn.toISOString(),
        },
      ]),
    )
    expect(despues.actividad.map((a) => a.id)).not.toContain(medidaDelEntrenador.id)
    const fechas = despues.actividad.map((a) => a.fecha)
    expect(fechas).toEqual([...fechas].sort().reverse())
  })

  it("avisa de quien no tiene el consentimiento de salud vigente", async () => {
    const { prisma, ids } = entorno
    const antes = await panel()
    await darConsentimiento(prisma, [ids.pendiente!])
    expect((await panel()).clientes.sinConsentimiento).toBe(antes.clientes.sinConsentimiento - 1)
    await prisma.consentimientoSalud.update({
      where: {
        usuarioId_version: { usuarioId: ids.pendiente!, version: VERSION_CONSENTIMIENTO },
      },
      data: { retiradoEn: new Date() },
    })
    expect((await panel()).clientes.sinConsentimiento).toBe(antes.clientes.sinConsentimiento)
  })

  it("cada entrenador ve la misma cartera y solo su propia lectura de comentarios", async () => {
    const { app, como, prisma, ids } = entorno
    const original = await prisma.usuario.findUniqueOrThrow({ where: { id: ids.entrenador } })
    await prisma.usuario.create({
      data: {
        nombre: "segundo",
        email: "segundo@e2e-entrenamiento-panel.test",
        passwordHash: original.passwordHash,
        rol: "entrenador",
        estado: "activo",
      },
    })
    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "segundo@e2e-entrenamiento-panel.test",
        contrasena: "Prueba-entrenamiento-2026!",
      })
      .expect(200)
    const comoSegundo = { Authorization: `Bearer ${login.body.tokenAcceso}` }

    await request(app.getHttpServer())
      .post(`/entrenamiento/sesiones/${empuje.id}/novedades/leidas`)
      .set(como("entrenador"))
      .send({ novedadIds: [comentarioId] })
      .expect(200)
    const [primero, segundo] = await Promise.all([panel(), panel(comoSegundo)])
    const idsDe = (datos: PanelHoy): string[] =>
      datos.porRevisar.comentarios.elementos.map((c) => c.novedadId)
    expect(idsDe(primero)).not.toContain(comentarioId)
    expect(idsDe(segundo)).toContain(comentarioId)
    expect(segundo.porRevisar.comentarios.total).toBe(primero.porRevisar.comentarios.total + 1)
    // Premisa de entrenador único: la cartera y su trabajo son los mismos para los dos.
    expect(segundo.clientes).toEqual(primero.clientes)
    expect(segundo.hoy).toEqual(primero.hoy)
    expect(segundo.semana).toEqual(primero.semana)
    expect(segundo.porRevisar.entrenamientos).toEqual(primero.porRevisar.entrenamientos)
  })
})
