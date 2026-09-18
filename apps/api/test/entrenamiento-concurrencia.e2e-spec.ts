import request from "supertest"
import { randomUUID } from "node:crypto"
import {
  PlanAsignadoSchema,
  ResultadoEntrenamientoSchema,
  type AsignarPlan,
} from "@alpha-omega/shared"
import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

describe("Concurrencia de agenda y entrenamiento por HTTP", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  beforeAll(async () => {
    entorno = await entornoEntrenamiento("concurrencia")
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  async function asignar(datos: AsignarPlan): Promise<string> {
    const r = await request(entorno.app.getHttpServer())
      .post(`/entrenamiento/clientes/${entorno.ids.cliente}/planes`)
      .set(entorno.como("entrenador"))
      .send(datos)
      .expect(201)
    return PlanAsignadoSchema.parse(r.body).sesiones[0]!.agenda.id
  }
  function registro(datos: AsignarPlan) {
    return {
      operacionId: randomUUID(),
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro: {
        notas: "carrera",
        series: [
          {
            serieId: datos.patron.sesiones[0]!.ejercicios[0]!.series[0]!.id,
            tipoMedicion: "repeticiones",
            pesoKg: 20,
            repeticiones: 10,
            hecha: true,
          },
        ],
      },
    }
  }
  it("mover y enviar simultáneamente dejan fecha, historial y cierre coherentes", async () => {
    const datos = entorno.plan(),
      id = await asignar(datos),
      http = entorno.app.getHttpServer()
    const [movimiento, envio] = await Promise.all([
      request(http)
        .patch(`/agenda/sesiones/${id}/fecha`)
        .set(entorno.como("cliente"))
        .send({ fecha: "2026-09-17", revision: 0 }),
      request(http)
        .post(`/entrenamiento/sesiones/${id}/enviar`)
        .set(entorno.como("cliente"))
        .send(registro(datos)),
    ])
    expect(envio.status).toBe(200)
    ResultadoEntrenamientoSchema.parse(envio.body)
    expect([200, 409]).toContain(movimiento.status)
    const agenda = await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })
    expect(agenda.estado).toBe("cerrada")
    expect(agenda.fechaActual.toISOString().slice(0, 10)).toBe(
      movimiento.status === 200 ? "2026-09-17" : "2026-09-14",
    )
    expect(await entorno.prisma.cambioDeFecha.count({ where: { sesionId: id } })).toBe(
      movimiento.status === 200 ? 1 : 0,
    )
  })
  it("el primer borrador y un ajuste concurrente no se pisan", async () => {
    const datos = entorno.plan(),
      id = await asignar(datos),
      http = entorno.app.getHttpServer()
    const [borrador, ajuste] = await Promise.all([
      request(http)
        .put(`/entrenamiento/sesiones/${id}/borrador`)
        .set(entorno.como("cliente"))
        .send(registro(datos)),
      request(http)
        .patch(`/entrenamiento/sesiones/${id}/prescripcion`)
        .set(entorno.como("entrenador"))
        .send({
          revisionPrescripcion: 0,
          nombre: "Ajustada",
          ejercicios: datos.patron.sesiones[0]!.ejercicios,
        }),
    ])
    expect([borrador.status, ajuste.status].sort()).toEqual([200, 409])
    const guardada = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(guardada.revisionPrescripcion).toBe(ajuste.status === 200 ? 1 : 0)
    expect(guardada.iniciada).toBe(borrador.status === 200)
  })
  it("dos envíos de la misma operación obtienen el mismo resultado y cierran una sola vez", async () => {
    const datos = entorno.plan(),
      id = await asignar(datos),
      cuerpo = registro(datos),
      http = entorno.app.getHttpServer()
    const respuestas = await Promise.all(
      [1, 2].map(() =>
        request(http)
          .post(`/entrenamiento/sesiones/${id}/enviar`)
          .set(entorno.como("cliente"))
          .send(cuerpo),
      ),
    )
    expect(respuestas.map((r) => r.status)).toEqual([200, 200])
    expect(respuestas[0]!.body).toEqual(respuestas[1]!.body)
    expect(await entorno.prisma.operacionEntrenamiento.count({ where: { sesionId: id } })).toBe(1)
    expect(
      (await entorno.prisma.sesionProgramada.findUniqueOrThrow({ where: { id } })).revision,
    ).toBe(1)
  })
  it("rechaza una versión de documento desconocida sin mutarla", async () => {
    const datos = entorno.plan(),
      id = await asignar(datos)
    await entorno.prisma.sesionEntrenamiento.update({ where: { id }, data: { version: 99 } })
    await request(entorno.app.getHttpServer())
      .put(`/entrenamiento/sesiones/${id}/borrador`)
      .set(entorno.como("cliente"))
      .send(registro(datos))
      .expect(500)
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.version).toBe(99)
    expect(fila.borrador).toBeNull()
    expect(fila.iniciada).toBe(false)
  })
})
