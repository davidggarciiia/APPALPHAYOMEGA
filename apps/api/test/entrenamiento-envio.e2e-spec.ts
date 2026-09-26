import {
  PanelSemanalSchema,
  ResultadoEntrenamientoSchema,
  SesionEntrenadorSchema,
} from "@alpha-omega/shared"
import { randomUUID } from "node:crypto"
import request from "supertest"

import {
  VACIA,
  crearCuenta,
  crearEjercicio,
  levantar,
  limpiar,
  registroDe,
  sesionDePrueba,
  type Cuenta,
  type Entorno,
} from "./ayudantes.js"

const SUFIJO = "@e2e-envio.test"
const PREFIJO = "e2e-envio"

describe("Entrenamiento: enviar", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let otroCliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta
  let ejercicioId: string

  const enviar = (cuenta: Cuenta, id: string, cuerpo: Record<string, unknown>): request.Test =>
    request(entorno.servidor())
      .post(`/entrenamiento/sesiones/${id}/enviar`)
      .set("Authorization", cuenta.cabecera)
      .send(cuerpo)
  const cuerpo = (registro: unknown, revisionBorrador = 0): Record<string, unknown> => ({
    operacionId: randomUUID(),
    revisionPrescripcion: 0,
    revisionBorrador,
    registro,
  })
  const parcial = (series: string[]): ReturnType<typeof registroDe> =>
    registroDe(
      series,
      [{ pesoKg: 42.5, valor: 8, hecha: true }, { pesoKg: 987.5, valor: 977, hecha: false }, VACIA],
      "Me costó la última",
    )

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

  it("publica un envío parcial, cierra la sesión y el entrenador lo ve", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const respuesta = await enviar(cliente, id, cuerpo(parcial(series))).expect(200)
    const resultado = ResultadoEntrenamientoSchema.parse(respuesta.body)
    expect(resultado.series).toEqual([
      {
        serieId: series[0],
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 42.5, repeticiones: 8 },
      },
      { serieId: series[1], hecha: false },
      { serieId: series[2], hecha: false },
    ])
    expect(JSON.stringify(resultado)).not.toContain("987.5")
    expect(JSON.stringify(resultado)).not.toContain(":977")
    expect(resultado.prescripcion.ejercicios[0]?.series[0]).toMatchObject({
      pesoKg: 40,
      repeticiones: 10,
    })

    const vistaEntrenador = await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/resultado`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(vistaEntrenador.body).toEqual(respuesta.body)
    expect(vistaEntrenador.body.notas).toBe("Me costó la última")

    const sesion = SesionEntrenadorSchema.parse(
      (
        await request(entorno.servidor())
          .get(`/entrenamiento/sesiones/${id}`)
          .set("Authorization", entrenador.cabecera)
      ).body,
    )
    expect(sesion).toMatchObject({ enviadoEn: resultado.enviadoEn, permiteAjuste: false })
    expect(sesion.agenda).toMatchObject({
      estado: "cerrada",
      revision: 1,
      fechaActual: "2026-09-14",
    })

    const panel = PanelSemanalSchema.parse(
      (
        await request(entorno.servidor())
          .get("/entrenamiento/sesiones")
          .query({ semana: "2026-09-14", clienteId: cliente.id })
          .set("Authorization", entrenador.cabecera)
      ).body,
    )
    expect(panel.sesiones[0]?.ejecucion).toEqual({ seriesHechas: 1, seriesPrescritas: 3 })

    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.borrador).toBeNull()
  })

  it("sin ninguna serie hecha no hay envío", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await enviar(cliente, id, cuerpo(registroDe(series, [VACIA, VACIA, VACIA]))).expect(400)
    await enviar(
      cliente,
      id,
      cuerpo(registroDe(series, [{ pesoKg: 40, valor: 10, hecha: false }, VACIA, VACIA])),
    ).expect(400)
    const fila = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
    expect(fila.estado).toBe("abierta")
  })

  it("reintentar tras perder la respuesta devuelve el mismo resultado sin duplicar", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const envio = cuerpo(parcial(series))
    const primera = await enviar(cliente, id, envio).expect(200)
    const segunda = await enviar(cliente, id, envio).expect(200)
    expect(segunda.body).toEqual(primera.body)
    const otro = await enviar(cliente, id, cuerpo(parcial(series))).expect(409)
    expect(otro.body.codigo).toBe("sesion_enviada")
    const cambiado = await enviar(cliente, id, {
      ...envio,
      registro: registroDe(series, [{ pesoKg: 50, valor: 8, hecha: true }, VACIA, VACIA]),
    }).expect(409)
    expect(cambiado.body.codigo).toBe("operacion_reutilizada")
  })

  it("cinco envíos idénticos a la vez responden lo mismo y publican una vez", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const envio = cuerpo(parcial(series))
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => enviar(cliente, id, envio)),
    )
    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200])
    expect(new Set(respuestas.map((r) => JSON.stringify(r.body))).size).toBe(1)
    const agenda = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
    expect(agenda.revision).toBe(1)
  })

  it("un guardado o un movimiento tardíos no reabren una sesión enviada", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await enviar(cliente, id, cuerpo(parcial(series))).expect(200)
    const tardio = await request(entorno.servidor())
      .put(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", cliente.cabecera)
      .send(cuerpo(registroDe(series, [VACIA, VACIA, VACIA])))
      .expect(409)
    expect(tardio.body.codigo).toBe("sesion_enviada")
    const movida = await request(entorno.servidor())
      .patch(`/agenda/sesiones/${id}/fecha`)
      .set("Authorization", cliente.cabecera)
      .send({ fecha: "2026-09-15", revision: 1 })
      .expect(409)
    expect(movida.body.codigo).toBe("sesion_cerrada")
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.borrador).toBeNull()
  })

  it("un envío con una revisión de borrador atrasada no pisa lo guardado desde otro móvil", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await request(entorno.servidor())
      .put(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", cliente.cabecera)
      .send(cuerpo(registroDe(series, [{ pesoKg: 40, valor: 10, hecha: true }, VACIA, VACIA])))
      .expect(200)
    const atrasado = await enviar(cliente, id, cuerpo(parcial(series), 0)).expect(409)
    expect(atrasado.body.codigo).toBe("borrador_cambiado")
    const agenda = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
    expect(agenda.estado).toBe("abierta")
    await enviar(cliente, id, cuerpo(parcial(series), 1)).expect(200)
  })

  it("mover y enviar a la vez deja siempre un estado coherente", async () => {
    for (let vuelta = 0; vuelta < 8; vuelta++) {
      const { id, series } = await sesionDePrueba(
        entorno,
        entrenador,
        cliente.id,
        ejercicioId,
        "2026-10-05",
      )
      const [envio, movimiento] = await Promise.all([
        enviar(cliente, id, cuerpo(parcial(series))),
        request(entorno.servidor())
          .patch(`/agenda/sesiones/${id}/fecha`)
          .set("Authorization", entrenador.cabecera)
          .send({ fecha: "2026-10-08", revision: 0 }),
      ])
      expect(envio.status).toBe(200)
      const agenda = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
      const entrenamiento = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({
        where: { id },
      })
      expect(agenda.estado).toBe("cerrada")
      expect(entrenamiento.enviadoEn).not.toBeNull()
      if (movimiento.status === 200) {
        expect(agenda.fechaActual.toISOString().slice(0, 10)).toBe("2026-10-08")
        expect(agenda.revision).toBe(2)
      } else {
        expect(movimiento.status).toBe(409)
        expect(agenda.fechaActual.toISOString().slice(0, 10)).toBe("2026-10-05")
      }
    }
  })

  it("el histórico sobrevive a retirar el ejercicio y dar de baja al cliente", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const otra = await sesionDePrueba(entorno, entrenador, otroCliente.id, ejercicioId)
    const enviado = await enviar(cliente, id, cuerpo(parcial(series))).expect(200)
    await request(entorno.servidor())
      .post(`/ejercicios/${ejercicioId}/retirar`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    await request(entorno.servidor())
      .post(`/usuarios/${cliente.id}/desactivar`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    const despues = await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/resultado`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(despues.body).toEqual(enviado.body)
    // Y una cuenta desactivada ya no envía nada.
    await entorno.prisma.usuario.update({
      where: { id: otroCliente.id },
      data: { estado: "desactivado" },
    })
    await enviar(otroCliente, otra.id, cuerpo(parcial(otra.series))).expect(401)
  })

  it("solo el dueño envía: entrenador, otro cliente, nutricionista, empleado y anónimo no", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await enviar(entrenador, id, cuerpo(parcial(series))).expect(403)
    await enviar(otroCliente, id, cuerpo(parcial(series))).expect(404)
    await enviar(nutricionista, id, cuerpo(parcial(series))).expect(403)
    await enviar(empleado, id, cuerpo(parcial(series))).expect(403)
    await request(entorno.servidor())
      .post(`/entrenamiento/sesiones/${id}/enviar`)
      .send(cuerpo(parcial(series)))
      .expect(401)
    await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/resultado`)
      .set("Authorization", otroCliente.cabecera)
      .expect(404)
    const agenda = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
    expect(agenda.estado).toBe("abierta")
  })
})
