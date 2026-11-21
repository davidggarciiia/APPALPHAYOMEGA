import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  ErrorDeApiSchema,
  ListadoAvisosReservaSchema,
  ListadoHuecosSchema,
  ListadoReservasSchema,
  ReservaSchema,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Reservas asignadas por el entrenador", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  let otroEntrenador: { Authorization: string }
  let numeroHueco = 0
  const rango = "desde=2099-01-01&hasta=2099-12-31"
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("reservas", async (prisma, ids) => {
      const usuarioId = { in: ids }
      const reservas = { OR: [{ clienteId: usuarioId }, { entrenadorId: usuarioId }] }
      await prisma.avisoReserva.deleteMany({ where: { reserva: reservas } })
      await prisma.reserva.deleteMany({ where: reservas })
      await prisma.movimientoBono.deleteMany({
        where: { OR: [{ clienteId: usuarioId }, { autorId: usuarioId }] },
      })
      await prisma.seguimientoBonos.deleteMany({
        where: { OR: [{ clienteId: usuarioId }, { autorId: usuarioId }] },
      })
      await prisma.huecoDisponibilidad.deleteMany({ where: { entrenadorId: usuarioId } })
      await prisma.aperturaDisponibilidad.deleteMany({ where: { entrenadorId: usuarioId } })
    })
    const entrenador = await entorno.prisma.usuario.findUniqueOrThrow({
      where: { id: entorno.ids.entrenador },
    })
    await entorno.prisma.usuario.create({
      data: {
        email: "segundo@e2e-entrenamiento-reservas.test",
        nombre: "Segundo entrenador",
        passwordHash: entrenador.passwordHash,
        rol: "entrenador",
        estado: "activo",
      },
    })
    const login = await request(entorno.app.getHttpServer())
      .post("/auth/login")
      .send({
        email: "segundo@e2e-entrenamiento-reservas.test",
        contrasena: "Prueba-entrenamiento-2026!",
      })
      .expect(200)
    otroEntrenador = { Authorization: `Bearer ${login.body.tokenAcceso}` }
  })
  beforeEach(async () => {
    const { prisma, ids } = entorno
    const clienteId = { in: [ids.cliente!, ids.otro!, ids.pendiente!, ids.desactivado!] }
    await prisma.avisoReserva.deleteMany({ where: { reserva: { clienteId } } })
    await prisma.reserva.deleteMany({ where: { clienteId } })
    await prisma.movimientoBono.deleteMany({ where: { clienteId } })
    await prisma.seguimientoBonos.deleteMany({ where: { clienteId } })
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const http = () => request(entorno.app.getHttpServer())
  const como = (rol = "entrenador") => entorno.como(rol)
  const numeroReservas = () =>
    entorno.prisma.reserva.count({ where: { entrenadorId: entorno.ids.entrenador } })
  async function hueco(
    servicios = ["entrenoPersonal", "seguimiento"],
    duracionMinutos = 60,
    fecha?: string,
  ) {
    const dia = fecha ?? `2099-01-${String(++numeroHueco).padStart(2, "0")}`
    const respuesta = await http()
      .post("/disponibilidad/huecos")
      .set(como())
      .send({
        operacionId: randomUUID(),
        fecha: dia,
        horaInicio: "10:00",
        duracionMinutos,
        servicios,
      })
      .expect(201)
    return ListadoHuecosSchema.parse(respuesta.body).huecos[0]!
  }
  const asignar = (
    huecoId: string,
    clienteId = entorno.ids.cliente!,
    servicio = "entrenoPersonal",
    operacionId = randomUUID(),
  ) => http().post("/reservas").set(como()).send({ operacionId, huecoId, clienteId, servicio })
  async function cargar(creditos = 10, clienteId = entorno.ids.cliente!) {
    await http()
      .post(`/bonos/clientes/${clienteId}/cargas`)
      .set(como())
      .send({
        operacionId: randomUUID(),
        servicio: "entrenoPersonal",
        creditos,
      })
      .expect(201)
  }
  async function saldo(clienteId = entorno.ids.cliente!) {
    return (await http().get(`/bonos/clientes/${clienteId}`).set(como()).expect(200)).body
  }
  async function activar() {
    await http()
      .patch(`/bonos/clientes/${entorno.ids.cliente}/seguimiento`)
      .set(como())
      .send({ activo: true })
      .expect(200)
  }
  const cancelar = (id: string, devolver = true) =>
    http().patch(`/reservas/${id}/cancelacion`).set(como()).send({ devolver })

  it("valida las entradas y bloquea a los perfiles sin permiso de escritura", async () => {
    await http().post("/reservas").send({}).expect(401)
    await http().post("/reservas").set(como()).send({}).expect(400)
    const base = {
      operacionId: randomUUID(),
      huecoId: randomUUID(),
      clienteId: entorno.ids.cliente,
      servicio: "entrenoPersonal",
    }
    for (const cambio of [
      { servicio: "quiromasaje" },
      { autorId: randomUUID() },
      { cantidad: 0 },
      { clienteId: "no" },
    ])
      await http()
        .post("/reservas")
        .set(como())
        .send({ ...base, ...cambio })
        .expect(400)
    for (const rol of ["cliente", "otro", "nutricionista", "empleado"]) {
      await http().post("/reservas").set(como(rol)).send(base).expect(403)
      await http()
        .patch(`/reservas/${randomUUID()}/cancelacion`)
        .set(como(rol))
        .send({ devolver: true })
        .expect(403)
      await http()
        .patch(`/reservas/${randomUUID()}/asistencia`)
        .set(como(rol))
        .send({ asistio: true })
        .expect(403)
      await http().get(`/reservas?${rango}`).set(como(rol)).expect(403)
    }
  })
  it("asigna, consume un crédito y emite un aviso conservando movimientos anteriores", async () => {
    await cargar(2)
    const libre = await hueco()
    const reserva = ReservaSchema.parse((await asignar(libre.id).expect(201)).body)
    expect(reserva).toMatchObject({
      huecoId: libre.id,
      clienteId: entorno.ids.cliente,
      entrenadorId: entorno.ids.entrenador,
      servicio: "entrenoPersonal",
      cantidadConsumida: 1,
      mesCupo: null,
      estado: "confirmada",
      asistio: null,
      devuelto: false,
    })
    expect((await saldo()).saldos[0].creditos).toBe(1)
    const movimientos = await entorno.prisma.movimientoBono.findMany({
      where: { clienteId: entorno.ids.cliente },
    })
    expect(movimientos.map((m) => m.cantidad).sort()).toEqual([-1, 2])
    expect(
      await entorno.prisma.huecoDisponibilidad.findUnique({ where: { id: libre.id } }),
    ).toMatchObject({ estado: "reservado" })
    const avisos = ListadoAvisosReservaSchema.parse(
      (
        await http()
          .get(`/reservas/clientes/${entorno.ids.cliente}/avisos`)
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(avisos).toMatchObject({ total: 1, sinLeer: 1 })
    expect(avisos.avisos[0]).toMatchObject({
      reservaId: reserva.id,
      tipo: "asignada",
      fecha: libre.fecha,
      leidaEn: null,
    })
  })
  it("sin crédito o seguimiento activo rechaza con motivo claro y sin ocupar el hueco", async () => {
    const libre = await hueco()
    for (const servicio of ["entrenoPersonal", "seguimiento"]) {
      const respuesta = await asignar(libre.id, undefined, servicio).expect(409)
      expect(ErrorDeApiSchema.parse(respuesta.body).message).toMatch(/créditos|seguimiento/i)
    }
    expect(await numeroReservas()).toBe(0)
    expect(
      await entorno.prisma.huecoDisponibilidad.findUnique({ where: { id: libre.id } }),
    ).toMatchObject({ estado: "libre" })
  })
  it("seguimiento descuenta duración del mes de cita y conserva intacto el mes actual", async () => {
    await activar()
    const actual = (await saldo()).seguimiento
    const libre = await hueco(["seguimiento"], 90)
    const reserva = ReservaSchema.parse(
      (await asignar(libre.id, undefined, "seguimiento").expect(201)).body,
    )
    expect(reserva).toMatchObject({ cantidadConsumida: 90, mesCupo: "2099-01" })
    const suma = await entorno.prisma.movimientoBono.aggregate({
      where: { clienteId: entorno.ids.cliente, mes: "2099-01" },
      _sum: { cantidad: true },
    })
    expect(suma._sum.cantidad).toBe(30)
    expect((await saldo()).seguimiento).toEqual(actual)
    const otro = await hueco(["seguimiento"], 60)
    const error = await asignar(otro.id, undefined, "seguimiento").expect(409)
    expect(ErrorDeApiSchema.parse(error.body).message).toMatch(/minutos|cupo/i)
    expect(await numeroReservas()).toBe(1)
  })
  it("dos asignaciones simultáneas del mismo hueco solo consumen a un cliente", async () => {
    await cargar(1)
    await cargar(1, entorno.ids.otro)
    const libre = await hueco()
    const respuestas = await Promise.all([asignar(libre.id), asignar(libre.id, entorno.ids.otro)])
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409])
    expect(
      (await saldo()).saldos[0].creditos + (await saldo(entorno.ids.otro)).saldos[0].creditos,
    ).toBe(1)
    expect(await numeroReservas()).toBe(1)
    ErrorDeApiSchema.parse(respuestas.find((r) => r.status === 409)!.body)
  })
  it("dos huecos simultáneos no gastan dos veces el último crédito", async () => {
    await cargar(1)
    const [a, b] = await Promise.all([hueco(), hueco()])
    const respuestas = await Promise.all([asignar(a.id), asignar(b.id)])
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409])
    expect((await saldo()).saldos[0].creditos).toBe(0)
    expect(await numeroReservas()).toBe(1)
    expect(
      await entorno.prisma.huecoDisponibilidad.count({
        where: { id: { in: [a.id, b.id] }, estado: "libre" },
      }),
    ).toBe(1)
  })
  it("reintentos simultáneos reproducen una sola asignación y rechazan claves incompatibles", async () => {
    await cargar(5)
    const libre = await hueco()
    const operacionId = randomUUID()
    const respuestas = await Promise.all([
      asignar(libre.id, undefined, undefined, operacionId),
      asignar(libre.id, undefined, undefined, operacionId),
    ])
    expect(respuestas.map((r) => r.status)).toEqual([201, 201])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect((await saldo()).saldos[0].creditos).toBe(4)
    const otro = await hueco()
    await asignar(otro.id, undefined, undefined, operacionId).expect(409)
    const concurrente = randomUUID()
    const [a, b] = await Promise.all([hueco(), hueco()])
    const mezcla = await Promise.all([
      asignar(a.id, undefined, undefined, concurrente),
      asignar(b.id, undefined, undefined, concurrente),
    ])
    expect(mezcla.map((r) => r.status).sort()).toEqual([201, 409])
    expect((await saldo()).saldos[0].creditos).toBe(3)
    expect(await numeroReservas()).toBe(2)
  })
  it("cancelar devuelve una vez, libera el hueco y no afecta una reasignación posterior", async () => {
    await cargar(2)
    const libre = await hueco()
    const inicial = (await asignar(libre.id).expect(201)).body
    const cancelaciones = await Promise.all([cancelar(inicial.id), cancelar(inicial.id)])
    expect(cancelaciones.map((r) => r.status)).toEqual([200, 200])
    expect(cancelaciones[0]!.body).toMatchObject({ estado: "cancelada", devuelto: true })
    expect((await saldo()).saldos[0].creditos).toBe(2)
    const nueva = (await asignar(libre.id).expect(201)).body
    await cancelar(inicial.id).expect(200)
    expect((await saldo()).saldos[0].creditos).toBe(1)
    expect(
      await entorno.prisma.huecoDisponibilidad.findUnique({ where: { id: libre.id } }),
    ).toMatchObject({ estado: "reservado" })
    expect(await entorno.prisma.reserva.findUnique({ where: { id: nueva.id } })).toMatchObject({
      estado: "confirmada",
    })
    expect(
      await entorno.prisma.movimientoBono.count({
        where: { tipo: "devolucion", clienteId: entorno.ids.cliente },
      }),
    ).toBe(1)
    expect(await entorno.prisma.avisoReserva.count({ where: { reservaId: inicial.id } })).toBe(2)
    await cancelar(inicial.id, false).expect(409)
  })
  it("cancelar sin devolución conserva consumo y protege la decisión repetida", async () => {
    await cargar(1)
    const reserva = (await asignar((await hueco()).id).expect(201)).body
    await cancelar(reserva.id, false).expect(200)
    await cancelar(reserva.id, false).expect(200)
    await cancelar(reserva.id, true).expect(409)
    expect((await saldo()).saldos[0].creditos).toBe(0)
    expect(
      await entorno.prisma.movimientoBono.count({
        where: { tipo: "devolucion", clienteId: entorno.ids.cliente },
      }),
    ).toBe(0)
  })
  it("devuelve al mes original tras el cambio de mes y la baja del cliente", async () => {
    await activar()
    const actual = (await saldo()).seguimiento
    const libre = await hueco(["seguimiento"], 60, "2020-01-15")
    const reserva = (await asignar(libre.id, undefined, "seguimiento").expect(201)).body
    await entorno.prisma.usuario.update({
      where: { id: entorno.ids.cliente },
      data: { estado: "desactivado" },
    })
    try {
      await cancelar(reserva.id).expect(200)
      expect((await saldo()).seguimiento).toEqual(actual)
      const movimientos = await entorno.prisma.movimientoBono.findMany({
        where: { clienteId: entorno.ids.cliente, mes: "2020-01" },
      })
      expect(movimientos.map((m) => m.cantidad).sort((a, b) => a - b)).toEqual([-60, 60, 120])
    } finally {
      await entorno.prisma.usuario.update({
        where: { id: entorno.ids.cliente },
        data: { estado: "activo" },
      })
    }
  })
  it("asistencia idempotente no modifica saldo y una cancelada no admite asistencia", async () => {
    await cargar(1)
    const reserva = (await asignar((await hueco()).id).expect(201)).body
    const marcar = (asistio: boolean) =>
      http().patch(`/reservas/${reserva.id}/asistencia`).set(como()).send({ asistio })
    const primera = await marcar(true).expect(200)
    expect(primera.body).toMatchObject({ asistio: true, estado: "confirmada" })
    expect((await marcar(true).expect(200)).body).toEqual(primera.body)
    expect((await marcar(false).expect(200)).body).toMatchObject({ asistio: false })
    expect((await saldo()).saldos[0].creditos).toBe(0)
    await cancelar(reserva.id).expect(200)
    await marcar(true).expect(409)
    await http()
      .patch(`/reservas/${reserva.id}/asistencia`)
      .set(como())
      .send({ asistio: null })
      .expect(400)
  })
  it("lista agenda y reservas propias sin revelar otros clientes, con rango y paginación", async () => {
    await cargar(2)
    await cargar(1, entorno.ids.otro)
    const propia = (await asignar((await hueco()).id).expect(201)).body
    await asignar((await hueco()).id, entorno.ids.otro).expect(201)
    const agenda = ListadoReservasSchema.parse(
      (await http().get(`/reservas?${rango}&limite=1`).set(como()).expect(200)).body,
    )
    expect(agenda.total).toBe(2)
    expect(agenda.reservas).toHaveLength(1)
    const cliente = ListadoReservasSchema.parse(
      (
        await http()
          .get(`/reservas/clientes/${entorno.ids.cliente}?${rango}`)
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(cliente.reservas.map((r) => r.id)).toEqual([propia.id])
    await http()
      .get(`/reservas/clientes/${entorno.ids.otro}?${rango}`)
      .set(como("cliente"))
      .expect(404)
    await http().get(`/reservas/clientes/${randomUUID()}?${rango}`).set(como()).expect(404)
    await http()
      .get(`/reservas/clientes/${entorno.ids.entrenador}?${rango}`)
      .set(como())
      .expect(404)
    await http()
      .get(`/reservas?${rango}`)
      .set(otroEntrenador)
      .expect(200, { reservas: [], total: 0 })
    await http().get(`/reservas?${rango}&limite=101`).set(como()).expect(400)
    await http().get(`/reservas/clientes/no-uuid?${rango}`).set(como()).expect(400)
    for (const rol of ["nutricionista", "empleado"])
      await http()
        .get(`/reservas/clientes/${entorno.ids.cliente}?${rango}`)
        .set(como(rol))
        .expect(403)
  })
  it("los avisos son privados, paginados y se marcan leídos una vez por el titular", async () => {
    await cargar(1)
    const reserva = (await asignar((await hueco()).id).expect(201)).body
    await cancelar(reserva.id).expect(200)
    const ruta = `/reservas/clientes/${entorno.ids.cliente}/avisos`
    const avisos = ListadoAvisosReservaSchema.parse(
      (await http().get(`${ruta}?limite=1`).set(como("cliente")).expect(200)).body,
    )
    expect(avisos).toMatchObject({ total: 2, sinLeer: 2 })
    expect(avisos.avisos).toHaveLength(1)
    expect(avisos.avisos[0]!.tipo).toBe("cancelada")
    const leer = `/reservas/avisos/${avisos.avisos[0]!.id}/lectura`
    await http().patch(leer).set(como("otro")).expect(404)
    await http().patch(leer).set(como()).expect(403)
    const leida = await http().patch(leer).set(como("cliente")).expect(200)
    expect(leida.body.leidaEn).not.toBeNull()
    expect((await http().patch(leer).set(como("cliente")).expect(200)).body).toEqual(leida.body)
    expect((await http().get(ruta).set(como("cliente")).expect(200)).body.sinLeer).toBe(1)
    await http().get(ruta).set(como("otro")).expect(404)
  })
  it("cierre y asignación compiten por el mismo hueco sin gastar si gana el cierre", async () => {
    await cargar(2)
    const libre = await hueco()
    const cerrar = (id: string) =>
      http().patch(`/disponibilidad/huecos/${id}/cerrar`).set(como()).send({})
    const respuestas = await Promise.all([asignar(libre.id), cerrar(libre.id)])
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(1)
    if (respuestas[0]!.status === 201) {
      expect(respuestas[1]!.status).toBe(409)
      expect((await saldo()).saldos[0].creditos).toBe(1)
    } else {
      expect(respuestas[0]!.status).toBe(409)
      expect(respuestas[1]!.status).toBe(200)
      expect((await saldo()).saldos[0].creditos).toBe(2)
    }
    const ocupada = (await asignar((await hueco()).id).expect(201)).body
    await cerrar(ocupada.huecoId).expect(409)
  })
  it("rechaza hueco cerrado, servicio incompatible, baja y operaciones ajenas", async () => {
    await cargar(3)
    const libre = await hueco(["seguimiento"])
    await asignar(libre.id).expect(409)
    await http().patch(`/disponibilidad/huecos/${libre.id}/cerrar`).set(como()).send({}).expect(200)
    await asignar(libre.id, undefined, "seguimiento").expect(409)
    const personal = await hueco()
    await asignar(personal.id, entorno.ids.desactivado).expect(409)
    await asignar(randomUUID()).expect(404)
    await asignar(personal.id, entorno.ids.entrenador).expect(404)
    await http()
      .post("/reservas")
      .set(otroEntrenador)
      .send({
        operacionId: randomUUID(),
        huecoId: personal.id,
        clienteId: entorno.ids.cliente,
        servicio: "entrenoPersonal",
      })
      .expect(404)
    const reserva = (await asignar(personal.id).expect(201)).body
    await http()
      .patch(`/reservas/${reserva.id}/cancelacion`)
      .set(otroEntrenador)
      .send({ devolver: true })
      .expect(404)
    await http()
      .patch(`/reservas/${reserva.id}/asistencia`)
      .set(otroEntrenador)
      .send({ asistio: true })
      .expect(404)
    await cancelar(randomUUID()).expect(404)
    await http().patch(`/reservas/${reserva.id}/cancelacion`).set(como()).send({}).expect(400)
  })
})
