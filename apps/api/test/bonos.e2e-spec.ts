import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  ListadoMovimientosBonoSchema,
  MovimientoBonoSchema,
  SaldoBonosSchema,
} from "@alpha-omega/shared"
import { mesBono } from "../src/bonos/mes-bono.js"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Bonos y seguimiento activo", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("bonos", async (prisma, ids) => {
      const clienteId = { in: ids }
      await prisma.movimientoBono.deleteMany({ where: { clienteId } })
      await prisma.seguimientoBonos.deleteMany({ where: { clienteId } })
    })
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  function ruta(cliente = entorno.ids.cliente) {
    return `/bonos/clientes/${cliente}`
  }

  async function saldo(cliente = entorno.ids.cliente) {
    const respuesta = await request(entorno.app.getHttpServer())
      .get(ruta(cliente))
      .set(entorno.como("entrenador"))
      .expect(200)
    return SaldoBonosSchema.parse(respuesta.body)
  }

  function cargar(creditos: number, operacionId = randomUUID(), cliente = entorno.ids.cliente) {
    return request(entorno.app.getHttpServer())
      .post(`${ruta(cliente)}/cargas`)
      .set(entorno.como("entrenador"))
      .send({ operacionId, servicio: "entrenoPersonal", creditos, nota: "Pagado en efectivo" })
  }

  it("ofrece entreno personal y seguimiento, sin ofrecer todavía quiromasaje", async () => {
    const { app, como } = entorno
    const respuesta = await request(app.getHttpServer())
      .get("/bonos/servicios")
      .set(como("cliente"))
      .expect(200)
    expect(respuesta.body.servicios).toEqual([
      { id: "entrenoPersonal", nombre: "Entreno personal", unidad: "creditos" },
      { id: "seguimiento", nombre: "Seguimiento", unidad: "minutos" },
    ])
  })

  it("carga un bono con autor, fecha y nota; el saldo suma cargas, consumos, devoluciones y ajustes", async () => {
    const { app, prisma, ids, como } = entorno
    expect((await saldo()).saldos).toEqual([{ servicio: "entrenoPersonal", creditos: 0 }])
    const carga = MovimientoBonoSchema.parse((await cargar(10).expect(201)).body)
    expect(carga).toMatchObject({
      clienteId: ids.cliente,
      autorId: ids.entrenador,
      tipo: "carga",
      cantidad: 10,
      mes: null,
      nota: "Pagado en efectivo",
    })
    expect(Number.isNaN(Date.parse(carga.creadoEn))).toBe(false)
    await prisma.movimientoBono.createMany({
      data: [
        { tipo: "consumo", cantidad: -2 },
        { tipo: "devolucion", cantidad: 1 },
      ].map((datos) => ({
        ...datos,
        tipo: datos.tipo as "consumo" | "devolucion",
        id: randomUUID(),
        operacionId: randomUUID(),
        servicio: "entrenoPersonal",
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
      })),
    })
    const ajuste = await request(app.getHttpServer())
      .post(`${ruta()}/ajustes`)
      .set(como("entrenador"))
      .send({
        operacionId: randomUUID(),
        servicio: "entrenoPersonal",
        creditos: -3,
        motivo: "Corrección de carga",
      })
      .expect(201)
    expect(ajuste.body).toMatchObject({ tipo: "ajuste", cantidad: -3, nota: "Corrección de carga" })
    expect((await saldo()).saldos[0]!.creditos).toBe(6)
    const historial = await request(app.getHttpServer())
      .get(`${ruta()}/movimientos?limite=2&desplazamiento=1`)
      .set(como("cliente"))
      .expect(200)
    const pagina = ListadoMovimientosBonoSchema.parse(historial.body)
    expect(pagina.total).toBe(4)
    expect(pagina.movimientos).toHaveLength(2)
    expect(pagina.movimientos.every((m) => m.clienteId === ids.cliente)).toBe(true)
    const http = request(app.getHttpServer())
    for (const metodo of ["delete", "patch"] as const)
      await http[metodo](`${ruta()}/movimientos/${carga.id}`)
        .set(como("entrenador"))
        .send({ cantidad: 0 })
        .expect(404)
    expect(await prisma.movimientoBono.findUnique({ where: { id: carga.id } })).toMatchObject({
      cantidad: 10,
    })
  })

  it("reintentos y cargas simultáneas no duplican movimientos; una clave reutilizada con otros datos falla", async () => {
    const operacionId = randomUUID()
    const inicial = await saldo()
    const respuestas = await Promise.all([cargar(5, operacionId), cargar(5, operacionId)])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    await cargar(5, operacionId).expect(201)
    await cargar(6, operacionId).expect(409)
    await cargar(5, operacionId, entorno.ids.otro).expect(409)
    expect((await saldo()).saldos[0]!.creditos).toBe(inicial.saldos[0]!.creditos + 5)
    expect((await saldo(entorno.ids.otro)).saldos[0]!.creditos).toBe(0)
  })

  it("dos ajustes concurrentes no permiten gastar el mismo saldo ni dejarlo negativo", async () => {
    const { app, como, ids } = entorno
    await cargar(5, randomUUID(), ids.otro).expect(201)
    const ajustar = () =>
      request(app.getHttpServer())
        .post(`${ruta(ids.otro)}/ajustes`)
        .set(como("entrenador"))
        .send({
          operacionId: randomUUID(),
          servicio: "entrenoPersonal",
          creditos: -4,
          motivo: "Corrección",
        })
    const respuestas = await Promise.all([ajustar(), ajustar()])
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409])
    expect((await saldo(ids.otro)).saldos[0]!.creditos).toBe(1)
  })

  it("sin seguimiento hay cero minutos; al activarlo concede 120 y reactivarlo conserva el consumo del mes", async () => {
    const { app, prisma, ids, como } = entorno
    expect((await saldo()).seguimiento).toEqual({
      activo: false,
      mes: mesBono(new Date()),
      minutosDisponibles: 0,
    })
    const cambiar = (activo: boolean) =>
      request(app.getHttpServer())
        .patch(`${ruta()}/seguimiento`)
        .set(como("entrenador"))
        .send({ activo })
    expect((await cambiar(true).expect(200)).body.seguimiento.minutosDisponibles).toBe(120)
    const mes = mesBono(new Date())
    await prisma.movimientoBono.create({
      data: {
        clienteId: ids.cliente!,
        autorId: ids.entrenador!,
        servicio: "seguimiento",
        tipo: "consumo",
        cantidad: -60,
        mes,
      },
    })
    expect((await saldo()).seguimiento.minutosDisponibles).toBe(60)
    expect((await cambiar(false).expect(200)).body.seguimiento).toMatchObject({
      activo: false,
      minutosDisponibles: 0,
    })
    expect((await cambiar(true).expect(200)).body.seguimiento.minutosDisponibles).toBe(60)
    await cambiar(true).expect(200)
    expect(
      await prisma.movimientoBono.count({
        where: { clienteId: ids.cliente, servicio: "seguimiento", tipo: "carga", mes },
      }),
    ).toBe(1)
    expect(
      await prisma.movimientoBono.count({
        where: { clienteId: ids.cliente, servicio: "seguimiento", tipo: "consumo", mes },
      }),
    ).toBe(1)
  })

  it("renueva el mes sin acumular sobrantes y dos lecturas simultáneas conceden un solo cupo", async () => {
    const { app, prisma, ids, como } = entorno
    await prisma.seguimientoBonos.create({
      data: { clienteId: ids.otro!, autorId: ids.entrenador!, activo: true },
    })
    await prisma.movimientoBono.createMany({
      data: [
        { tipo: "carga" as const, cantidad: 120 },
        { tipo: "consumo" as const, cantidad: -30 },
      ].map((datos) => ({
        ...datos,
        id: randomUUID(),
        operacionId: randomUUID(),
        clienteId: ids.otro!,
        autorId: ids.entrenador!,
        servicio: "seguimiento",
        mes: "2020-01",
      })),
    })
    const respuestas = await Promise.all([saldo(ids.otro), saldo(ids.otro)])
    expect(respuestas.map((r) => r.seguimiento.minutosDisponibles)).toEqual([120, 120])
    const propia = await request(app.getHttpServer())
      .get(ruta(ids.otro))
      .set(como("otro"))
      .expect(200)
    expect(propia.body.seguimiento).toMatchObject({ activo: true, minutosDisponibles: 120 })
    expect(
      await prisma.movimientoBono.count({
        where: {
          clienteId: ids.otro,
          servicio: "seguimiento",
          tipo: "carga",
          mes: mesBono(new Date()),
        },
      }),
    ).toBe(1)
    expect(
      await prisma.movimientoBono.count({ where: { clienteId: ids.otro, mes: "2020-01" } }),
    ).toBe(2)
  })

  it("protege lectura y escritura por identidad; no revela saldos ajenos ni admite alterar movimientos", async () => {
    const { app, como, ids } = entorno
    await request(app.getHttpServer()).get(ruta()).expect(401)
    for (const rol of ["otro", "nutricionista", "empleado"]) {
      for (const sufijo of ["", "/movimientos"])
        await request(app.getHttpServer())
          .get(`${ruta()}${sufijo}`)
          .set(como(rol))
          .expect(rol === "otro" ? 404 : 403)
    }
    for (const rol of ["cliente", "otro", "nutricionista", "empleado"]) {
      await request(app.getHttpServer())
        .post(`${ruta()}/cargas`)
        .set(como(rol))
        .send({ operacionId: randomUUID(), servicio: "entrenoPersonal", creditos: 2 })
        .expect(403)
      await request(app.getHttpServer())
        .post(`${ruta()}/ajustes`)
        .set(como(rol))
        .send({
          operacionId: randomUUID(),
          servicio: "entrenoPersonal",
          creditos: 1,
          motivo: "Intento",
        })
        .expect(403)
      await request(app.getHttpServer())
        .patch(`${ruta()}/seguimiento`)
        .set(como(rol))
        .send({ activo: true })
        .expect(403)
    }
    for (const destino of [randomUUID(), ids.entrenador])
      await request(app.getHttpServer()).get(ruta(destino)).set(como("entrenador")).expect(404)
    await cargar(2, randomUUID(), ids.desactivado).expect(409)
    await request(app.getHttpServer())
      .patch(`${ruta(ids.desactivado)}/seguimiento`)
      .set(como("entrenador"))
      .send({ activo: true })
      .expect(409)
  })

  it("valida importes, motivo, servicio, paginación y campos ajenos al contrato sin cambiar el saldo", async () => {
    const { app, como } = entorno
    const inicial = await saldo()
    const base = { operacionId: randomUUID(), servicio: "entrenoPersonal", creditos: 1 }
    for (const cambio of [
      { creditos: 0 },
      { creditos: -1 },
      { creditos: 1.5 },
      { creditos: 1000001 },
      { servicio: "quiromasaje" },
      { servicio: "seguimiento" },
      { autorId: randomUUID() },
    ])
      await request(app.getHttpServer())
        .post(`${ruta()}/cargas`)
        .set(como("entrenador"))
        .send({ ...base, ...cambio })
        .expect(400)
    for (const cambio of [{ creditos: 0 }, { motivo: " " }, { motivo: undefined }])
      await request(app.getHttpServer())
        .post(`${ruta()}/ajustes`)
        .set(como("entrenador"))
        .send({ ...base, motivo: "Ajuste", ...cambio })
        .expect(400)
    await request(app.getHttpServer())
      .get(`${ruta()}/movimientos?limite=101`)
      .set(como("cliente"))
      .expect(400)
    await request(app.getHttpServer())
      .get("/bonos/clientes/no-uuid")
      .set(como("entrenador"))
      .expect(400)
    expect((await saldo()).saldos).toEqual(inicial.saldos)
  })

  it("admite bonos sin nota para pendientes y reproduce un ajuste sin aplicarlo otra vez tras consumos posteriores", async () => {
    const { app, prisma, como, ids } = entorno
    const base = `/bonos/clientes/${ids.pendiente}`
    const carga = await request(app.getHttpServer())
      .post(`${base}/cargas`)
      .set(como("entrenador"))
      .send({ operacionId: randomUUID(), servicio: "entrenoPersonal", creditos: 10 })
      .expect(201)
    expect(carga.body.nota).toBeNull()
    const datos = {
      operacionId: randomUUID(),
      servicio: "entrenoPersonal",
      creditos: 5,
      motivo: "Créditos pendientes de anotar",
    }
    const ajustar = (motivo = datos.motivo) =>
      request(app.getHttpServer())
        .post(`${base}/ajustes`)
        .set(como("entrenador"))
        .send({ ...datos, motivo })
    const original = await ajustar().expect(201)
    await prisma.movimientoBono.create({
      data: {
        clienteId: ids.pendiente!,
        autorId: ids.entrenador!,
        servicio: "entrenoPersonal",
        tipo: "consumo",
        cantidad: -2,
      },
    })
    expect((await ajustar().expect(201)).body).toEqual(original.body)
    await ajustar("Otro motivo").expect(409)
    expect((await saldo(ids.pendiente)).saldos[0]!.creditos).toBe(13)
  })

  it("la misma clave simultánea para dos clientes solo crea un movimiento", async () => {
    const { prisma, ids } = entorno
    const operacionId = randomUUID()
    const iniciales = await Promise.all([saldo(ids.cliente), saldo(ids.otro)])
    const respuestas = await Promise.all([
      cargar(2, operacionId, ids.cliente),
      cargar(2, operacionId, ids.otro),
    ])
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409])
    expect(
      await prisma.movimientoBono.count({ where: { autorId: ids.entrenador, operacionId } }),
    ).toBe(1)
    const finales = await Promise.all([saldo(ids.cliente), saldo(ids.otro)])
    const suma = (saldos: typeof finales) =>
      saldos.reduce((total, s) => total + s.saldos[0]!.creditos, 0)
    expect(suma(finales)).toBe(suma(iniciales) + 2)
  })

  it("PostgreSQL protege signo, mes, cupo único y conservación del histórico", async () => {
    const { prisma, ids } = entorno
    const base = {
      clienteId: ids.cliente!,
      autorId: ids.entrenador!,
      servicio: "entrenoPersonal" as const,
      tipo: "carga" as const,
      cantidad: 1,
    }
    const total = await prisma.movimientoBono.count({ where: { clienteId: ids.cliente } })
    for (const cambio of [
      { cantidad: 0 },
      { cantidad: -1 },
      { tipo: "consumo" as const, cantidad: 1 },
      { tipo: "devolucion" as const, cantidad: -1 },
      { mes: "2026-10" },
      { servicio: "seguimiento" as const, cantidad: 120 },
      { servicio: "seguimiento" as const, mes: "2026-13", cantidad: 120 },
      { servicio: "seguimiento" as const, mes: "2026-10", cantidad: 60 },
    ])
      await expect(prisma.movimientoBono.create({ data: { ...base, ...cambio } })).rejects.toThrow()
    await expect(
      prisma.movimientoBono.create({
        data: { ...base, servicio: "seguimiento", cantidad: 120, mes: mesBono(new Date()) },
      }),
    ).rejects.toMatchObject({ code: "P2002" })
    await expect(prisma.usuario.delete({ where: { id: ids.cliente } })).rejects.toMatchObject({
      code: "P2003",
    })
    expect(await prisma.movimientoBono.count({ where: { clienteId: ids.cliente } })).toBe(total)
  })
})
