import {
  ListadoCambiosDeFechaSchema,
  ListadoSesionesSchema,
  PanelSemanalSchema,
  SesionProgramadaSchema,
} from "@alpha-omega/shared"
import request from "supertest"

import {
  ID_INEXISTENTE,
  asignar,
  crearCuenta,
  crearEjercicio,
  levantar,
  limpiar,
  planDe,
  type Cuenta,
  type Entorno,
} from "./ayudantes.js"

const SUFIJO = "@e2e-agenda.test"
const PREFIJO = "e2e-agenda"

describe("Agenda: cambios de día", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let otroCliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta
  let ejercicioId: string

  async function mover(
    cuenta: Cuenta,
    id: string,
    fecha: string,
    revision: number,
  ): Promise<request.Response> {
    return request(entorno.servidor())
      .patch(`/agenda/sesiones/${id}/fecha`)
      .set("Authorization", cuenta.cabecera)
      .send({ fecha, revision })
  }

  async function semana(cuenta: Cuenta, clienteId: string, lunes: string, semanas = 1) {
    const respuesta = await request(entorno.servidor())
      .get(`/entrenamiento/clientes/${clienteId}/sesiones`)
      .query({ semana: lunes, semanas })
      .set("Authorization", cuenta.cabecera)
      .expect(200)
    return ListadoSesionesSchema.parse(respuesta.body).sesiones
  }

  beforeAll(async () => {
    entorno = await levantar()
  })

  beforeEach(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    entrenador = await crearCuenta(entorno, "entrenador", "entrenador", SUFIJO)
    cliente = await crearCuenta(entorno, "cliente", "cliente", SUFIJO)
    otroCliente = await crearCuenta(entorno, "otro", "cliente", SUFIJO)
    nutricionista = await crearCuenta(entorno, "nutricionista", "nutricionista", SUFIJO)
    empleado = await crearCuenta(entorno, "empleado", "empleado", SUFIJO)
    ejercicioId = (await crearEjercicio(entorno, `${PREFIJO} press`)).id
  })

  afterAll(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    await entorno.app.close()
  })

  it("mueve del lunes al viernes conservando id y fecha original, y el entrenador lo ve", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 2, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const lunes = plan.sesiones[0]
    expect(lunes?.agenda.fechaActual).toBe("2026-09-14")
    const movida = await mover(cliente, lunes?.agenda.id ?? "", "2026-09-18", 0)
    expect(movida.status).toBe(200)
    expect(SesionProgramadaSchema.parse(movida.body)).toMatchObject({
      id: lunes?.agenda.id,
      fechaOriginal: "2026-09-14",
      fechaActual: "2026-09-18",
      revision: 1,
      estado: "abierta",
    })

    const panel = await request(entorno.servidor())
      .get("/entrenamiento/sesiones")
      .query({ semana: "2026-09-14", clienteId: cliente.id })
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    const fila = PanelSemanalSchema.parse(panel.body).sesiones[0]
    expect(fila?.agenda).toMatchObject({ fechaOriginal: "2026-09-14", fechaActual: "2026-09-18" })

    // La semana siguiente no se toca.
    const siguiente = await semana(cliente, cliente.id, "2026-09-21")
    expect(siguiente.map((s) => s.agenda.fechaActual)).toEqual(["2026-09-21"])

    const cambios = await request(entorno.servidor())
      .get(`/agenda/sesiones/${lunes?.agenda.id ?? ""}/cambios`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(ListadoCambiosDeFechaSchema.parse(cambios.body).cambios).toEqual([
      expect.objectContaining({
        fechaAnterior: "2026-09-14",
        fechaNueva: "2026-09-18",
        autorId: cliente.id,
      }),
    ])
  })

  it("no sale de la semana de su fecha original aunque se mueva varias veces", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 3 }]),
    )
    const id = plan.sesiones[0]?.agenda.id ?? ""
    expect((await mover(cliente, id, "2026-09-20", 0)).status).toBe(200)
    const fuera = await mover(cliente, id, "2026-09-21", 1)
    expect(fuera.status).toBe(400)
    expect(fuera.body.codigo).toBe("fuera_de_semana")
    expect((await mover(entrenador, id, "2026-09-13", 1)).status).toBe(400)
    expect((await mover(entrenador, id, "2026-09-14", 1)).status).toBe(200)
  })

  it("respeta fin de año, año bisiesto y cambio de hora sin desplazar fechas", async () => {
    const original = process.env.TZ
    try {
      for (const zona of ["Pacific/Kiritimati", "America/Los_Angeles", "Europe/Madrid"]) {
        process.env.TZ = zona
        const finDeAño = await asignar(
          entorno,
          entrenador,
          cliente.id,
          planDe(ejercicioId, "2026-12-28", 1, [{ nombre: `Fin ${zona}`, diaSemana: 5 }]),
        )
        const id = finDeAño.sesiones[0]?.agenda.id ?? ""
        expect(finDeAño.sesiones[0]?.agenda.fechaActual).toBe("2027-01-01")
        const domingo = await mover(cliente, id, "2027-01-03", 0)
        expect(domingo.body.fechaActual).toBe("2027-01-03")
        expect((await mover(cliente, id, "2027-01-04", 1)).status).toBe(400)
      }
      const verano = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(ejercicioId, "2026-03-23", 1, [{ nombre: "Cambio de hora", diaSemana: 1 }]),
      )
      const movida = await mover(cliente, verano.sesiones[0]?.agenda.id ?? "", "2026-03-29", 0)
      expect(movida.body.fechaActual).toBe("2026-03-29")
      const bisiesto = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(ejercicioId, "2028-02-28", 1, [{ nombre: "Bisiesto", diaSemana: 2 }]),
      )
      expect(bisiesto.sesiones[0]?.agenda.fechaActual).toBe("2028-02-29")
      const listado = await semana(cliente, cliente.id, "2028-02-28")
      expect(listado.map((s) => s.agenda.fechaActual)).toEqual(["2028-02-29"])
    } finally {
      process.env.TZ = original
    }
  })

  it("mover a un día ocupado conserva las dos sesiones", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 1, [
        { nombre: "Uno", diaSemana: 1 },
        { nombre: "Dos", diaSemana: 2 },
      ]),
    )
    const segunda = plan.sesiones[1]?.agenda.id ?? ""
    expect((await mover(cliente, segunda, "2026-09-14", 0)).status).toBe(200)
    const listado = await semana(entrenador, cliente.id, "2026-09-14")
    expect(listado.map((s) => [s.nombre, s.agenda.fechaActual])).toEqual([
      ["Uno", "2026-09-14"],
      ["Dos", "2026-09-14"],
    ])
  })

  it("dos movimientos con la misma revisión no se pisan", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const id = plan.sesiones[0]?.agenda.id ?? ""
    const [a, b] = await Promise.all([
      mover(cliente, id, "2026-09-15", 0),
      mover(entrenador, id, "2026-09-16", 0),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const perdedor = a.status === 409 ? a : b
    expect(perdedor.body).toMatchObject({ codigo: "revision_obsoleta" })
    expect(perdedor.body.actual.revision).toBe(1)
    const tarde = await mover(cliente, id, "2026-09-17", 0)
    expect(tarde.status).toBe(409)
  })

  it("una sesión cerrada no se mueve", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const id = plan.sesiones[0]?.agenda.id ?? ""
    await entorno.prisma.sesionProgramada.update({ where: { id }, data: { estado: "cerrada" } })
    const respuesta = await mover(cliente, id, "2026-09-15", 0)
    expect(respuesta.status).toBe(409)
    expect(respuesta.body.codigo).toBe("sesion_cerrada")
  })

  it("otro cliente, nutricionista, empleado y sin sesión reciben denegación", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicioId, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const id = plan.sesiones[0]?.agenda.id ?? ""
    expect((await mover(otroCliente, id, "2026-09-15", 0)).status).toBe(404)
    await request(entorno.servidor())
      .get(`/agenda/sesiones/${id}/cambios`)
      .set("Authorization", otroCliente.cabecera)
      .expect(404)
    for (const cuenta of [nutricionista, empleado]) {
      expect((await mover(cuenta, id, "2026-09-15", 0)).status).toBe(403)
      await request(entorno.servidor())
        .get(`/agenda/sesiones/${id}/cambios`)
        .set("Authorization", cuenta.cabecera)
        .expect(403)
    }
    await request(entorno.servidor())
      .patch(`/agenda/sesiones/${id}/fecha`)
      .send({ fecha: "2026-09-15", revision: 0 })
      .expect(401)
    await request(entorno.servidor()).get(`/agenda/sesiones/${id}/cambios`).expect(401)
    expect((await mover(cliente, ID_INEXISTENTE, "2026-09-15", 0)).status).toBe(404)
    const intacta = await semana(cliente, cliente.id, "2026-09-14")
    expect(intacta[0]?.agenda).toMatchObject({ fechaActual: "2026-09-14", revision: 0 })
  })
})
