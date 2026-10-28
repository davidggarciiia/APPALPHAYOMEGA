import { randomUUID } from "node:crypto"
import request from "supertest"
import { CONFIGURACION_SEGUIMIENTO_INICIAL, ZONA_AGENDA } from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { darConsentimiento } from "./valoraciones-ayuda.js"

function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())
}

/**
 * CARACTERIZACIÓN: fija la política de acceso que existe hoy en medidas y pruebas
 * físicas para dos casos que SPEC no precisa (decisiones D3 y D4 de
 * tasks/plan-mejoras-2026-10-27.md). Estas pruebas no dicen que la política sea la
 * correcta: dicen cuál es. Si David decide cambiarla, estas pruebas son las que
 * deben cambiar a propósito.
 *
 * D3. ¿Puede el entrenador completar medidas y pruebas de un cliente dado de baja?
 * D4. ¿Qué pruebas físicas puede consultar el nutricionista asignado?
 */
describe("Acceso a medidas y pruebas físicas (política vigente)", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const pruebaPrescrita = randomUUID()
  const ruta = (clienteId: string, resto: string) => `/seguimiento/clientes/${clienteId}/${resto}`

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("seguimiento-acceso")
    const { prisma, ids } = entorno
    await darConsentimiento(prisma, [ids.desactivado!])
    // La baja bloquea guardar la configuración, así que la prueba prescrita se crea
    // directamente: es lo que habría ocurrido si la baja llegó después de configurarla.
    for (const clienteId of [ids.cliente!, ids.desactivado!]) {
      await prisma.configuracionSeguimiento.create({
        data: {
          clienteId,
          revision: 1,
          documento: {
            ...CONFIGURACION_SEGUIMIENTO_INICIAL,
            pruebasPrescritas: [{ id: pruebaPrescrita, nombre: "Flexiones", unidad: "reps" }],
          },
        },
      })
    }
  })

  afterAll(async () => {
    if (entorno) {
      const { prisma, ids } = entorno
      await prisma.asignacionNutricionista.deleteMany({
        where: { nutricionistaId: ids.nutricionista! },
      })
      await prisma.configuracionSeguimiento.deleteMany({
        where: { clienteId: { in: [ids.cliente!, ids.desactivado!] } },
      })
    }
    await entorno?.cerrar()
  })

  const medida = () => ({
    operacionId: randomUUID(),
    fecha: hoy(),
    pesoKg: 80,
    cinturaCm: null,
    grasaPct: null,
    alturaCm: null,
  })
  const prueba = () => ({
    operacionId: randomUUID(),
    fecha: hoy(),
    valor: 20,
    pruebaId: pruebaPrescrita,
  })

  describe("D3 · cliente dado de baja", () => {
    it("el entrenador SÍ puede apuntarle una medida", async () => {
      const { app, como, ids } = entorno
      await request(app.getHttpServer())
        .post(ruta(ids.desactivado!, "medidas"))
        .set(como("entrenador"))
        .send(medida())
        .expect(201)
    })

    it("el entrenador SÍ puede registrarle una prueba ya prescrita", async () => {
      const { app, como, ids } = entorno
      await request(app.getHttpServer())
        .post(ruta(ids.desactivado!, "pruebas"))
        .set(como("entrenador"))
        .send(prueba())
        .expect(201)
    })

    it("pero NO puede cambiar su configuración de seguimiento: está dado de baja", async () => {
      const { app, como, ids } = entorno
      const respuesta = await request(app.getHttpServer())
        .put(ruta(ids.desactivado!, "configuracion"))
        .set(como("entrenador"))
        .send({ ...CONFIGURACION_SEGUIMIENTO_INICIAL, revision: 1 })
        .expect(409)
      expect(respuesta.body.codigo).toBe("operacion_incompatible")
    })
  })

  describe("D4 · nutricionista asignado", () => {
    beforeAll(async () => {
      const { prisma, ids } = entorno
      await prisma.asignacionNutricionista.createMany({
        data: [
          { nutricionistaId: ids.nutricionista!, clienteId: ids.cliente! },
          { nutricionistaId: ids.nutricionista!, clienteId: ids.desactivado! },
        ],
      })
    })

    it("sin asignación no ve ni medidas ni pruebas de otro cliente", async () => {
      const { app, como, ids } = entorno
      const http = app.getHttpServer()
      await request(http).get(ruta(ids.otro!, "medidas")).set(como("nutricionista")).expect(403)
      await request(http).get(ruta(ids.otro!, "pruebas")).set(como("nutricionista")).expect(403)
    })

    it("con asignación lee TODAS las pruebas físicas, sea quien sea su autor", async () => {
      const { app, como, ids } = entorno
      const http = app.getHttpServer()
      await request(http)
        .post(ruta(ids.cliente!, "pruebas"))
        .set(como("entrenador"))
        .send(prueba())
        .expect(201)
      const leidas = await request(http)
        .get(ruta(ids.cliente!, "pruebas"))
        .set(como("nutricionista"))
        .expect(200)
      expect(JSON.stringify(leidas.body)).toContain("Flexiones")
      await request(http)
        .get(ruta(ids.cliente!, "pruebas/pagina"))
        .set(como("nutricionista"))
        .expect(200)
    })

    it("puede apuntar medidas, pero NO registrar pruebas", async () => {
      const { app, como, ids } = entorno
      const http = app.getHttpServer()
      await request(http)
        .post(ruta(ids.cliente!, "medidas"))
        .set(como("nutricionista"))
        .send(medida())
        .expect(201)
      await request(http)
        .post(ruta(ids.cliente!, "pruebas"))
        .set(como("nutricionista"))
        .send(prueba())
        .expect(403)
    })

    it("si el cliente se da de baja, la asignación deja de dar acceso a todo", async () => {
      const { app, como, ids } = entorno
      const http = app.getHttpServer()
      for (const recurso of ["medidas", "medidas/pagina", "pruebas", "pruebas/pagina"])
        await request(http)
          .get(ruta(ids.desactivado!, recurso))
          .set(como("nutricionista"))
          .expect(403)
    })
  })
})
