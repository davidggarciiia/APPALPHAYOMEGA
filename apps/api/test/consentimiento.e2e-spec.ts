import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  EstadoConsentimientoSchema,
  VERSION_CONSENTIMIENTO,
  ZONA_AGENDA,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

/** Datos sintéticos: ningún valor corresponde a una persona real. */
describe("Consentimiento de datos de salud (RGPD, art. 9)", () => {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const http = () => entorno.app.getHttpServer()
  const cliente = () => entorno.ids.cliente!
  const medida = (rol: string, clienteId = cliente()) =>
    request(http()).post(`/seguimiento/clientes/${clienteId}/medidas`).set(entorno.como(rol)).send({
      operacionId: randomUUID(),
      fecha: hoy,
      pesoKg: 80.5,
      cinturaCm: null,
      grasaPct: null,
      alturaCm: null,
    })
  const estado = async () =>
    EstadoConsentimientoSchema.parse(
      (await request(http()).get("/consentimiento").set(entorno.como("cliente")).expect(200)).body,
    )

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("consentimiento")
    // Este cliente empieza sin consentimiento; «otro» lo tiene.
    await entorno.prisma.consentimientoSalud.deleteMany({ where: { usuarioId: cliente() } })
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it("sin consentimiento no se guarda ningún dato de salud del cliente, lo registre quien lo registre", async () => {
    expect(await estado()).toEqual({
      version: null,
      aceptadoEn: null,
      retiradoEn: null,
      vigente: false,
      versionVigente: VERSION_CONSENTIMIENTO,
    })
    const propio = await medida("cliente").expect(409)
    expect(propio.body).toMatchObject({
      codigo: "consentimiento_pendiente",
      message: "Antes de guardar datos de salud necesitamos tu consentimiento.",
    })
    const delEquipo = await medida("entrenador").expect(409)
    expect(delEquipo.body).toMatchObject({
      codigo: "consentimiento_pendiente",
      message: "Este cliente aún no ha dado su consentimiento para tratar sus datos de salud.",
    })
    expect(await entorno.prisma.medidaCorporal.count({ where: { clienteId: cliente() } })).toBe(0)
  })

  it("solo se acepta la versión vigente marcada explícitamente", async () => {
    for (const cuerpo of [
      { version: "otra-version", acepto: true },
      { version: VERSION_CONSENTIMIENTO, acepto: false },
      { version: VERSION_CONSENTIMIENTO },
    ])
      await request(http())
        .post("/consentimiento")
        .set(entorno.como("cliente"))
        .send(cuerpo)
        .expect(400)
    expect((await estado()).vigente).toBe(false)
  })

  it("aceptar habilita el guardado; retirarlo lo vuelve a impedir y aceptarlo de nuevo lo reactiva", async () => {
    const aceptar = () =>
      request(http())
        .post("/consentimiento")
        .set(entorno.como("cliente"))
        .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
        .expect(201)
    const aceptado = EstadoConsentimientoSchema.parse((await aceptar()).body)
    expect(aceptado).toMatchObject({ version: VERSION_CONSENTIMIENTO, vigente: true })
    // Repetir no crea otra fila ni cambia la fecha.
    expect(EstadoConsentimientoSchema.parse((await aceptar()).body).aceptadoEn).toBe(
      aceptado.aceptadoEn,
    )
    await medida("cliente").expect(201)
    await medida("entrenador").expect(201)

    const retirado = EstadoConsentimientoSchema.parse(
      (await request(http()).delete("/consentimiento").set(entorno.como("cliente")).expect(200))
        .body,
    )
    expect(retirado).toMatchObject({ vigente: false, retiradoEn: expect.any(String) })
    await medida("entrenador").expect(409)
    // Lo tratado antes no se borra.
    expect(await entorno.prisma.medidaCorporal.count({ where: { clienteId: cliente() } })).toBe(2)

    const reactivado = EstadoConsentimientoSchema.parse((await aceptar()).body)
    expect(reactivado).toMatchObject({ vigente: true, retiradoEn: null })
    expect(Date.parse(reactivado.aceptadoEn!)).toBeGreaterThan(Date.parse(aceptado.aceptadoEn!))
    await medida("cliente").expect(201)
    expect(
      await entorno.prisma.consentimientoSalud.count({ where: { usuarioId: cliente() } }),
    ).toBe(1)
  })

  it("el equipo consulta el consentimiento de sus clientes y nadie más lo averigua", async () => {
    const delEntrenador = EstadoConsentimientoSchema.parse(
      (
        await request(http())
          .get(`/seguimiento/clientes/${cliente()}/consentimiento`)
          .set(entorno.como("entrenador"))
          .expect(200)
      ).body,
    )
    expect(delEntrenador.vigente).toBe(true)
    // Nutricionista sin asignar, otro cliente y empleado: sin acceso.
    for (const rol of ["nutricionista", "otro", "empleado"])
      await request(http())
        .get(`/seguimiento/clientes/${cliente()}/consentimiento`)
        .set(entorno.como(rol))
        .expect(403)
    // Solo el cliente da o retira el suyo.
    await request(http()).delete("/consentimiento").set(entorno.como("entrenador")).expect(403)

    // Un cliente que escribe sobre otro recibe la denegación de alcance, no el
    // estado del consentimiento ajeno.
    await entorno.prisma.consentimientoSalud.deleteMany({ where: { usuarioId: entorno.ids.otro! } })
    const ajena = await medida("cliente", entorno.ids.otro!).expect(403)
    expect(ajena.body.codigo).not.toBe("consentimiento_pendiente")
  })
})
