import {
  ListadoRutinasSchema,
  RutinaGuardadaSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
} from "@alpha-omega/shared"
import { randomUUID } from "node:crypto"
import request from "supertest"

import {
  VACIA,
  asignar,
  crearCuenta,
  crearEjercicio,
  levantar,
  limpiar,
  patronDe,
  planDe,
  registroDe,
  sesionDePrueba,
  type Cuenta,
  type Entorno,
} from "./ayudantes.js"

const SUFIJO = "@e2e-ajustes.test"
const PREFIJO = "e2e-ajustes"

describe("Entrenamiento: ajustes de sesión y rutinas guardadas", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let otroCliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta
  let press: { id: string; nombre: string }
  let remo: { id: string; nombre: string }

  const ajustar = (cuenta: Cuenta, id: string, cuerpo: Record<string, unknown>): request.Test =>
    request(entorno.servidor())
      .patch(`/entrenamiento/sesiones/${id}/prescripcion`)
      .set("Authorization", cuenta.cabecera)
      .send(cuerpo)
  const cambio = (
    ejercicioId: string,
    revisionPrescripcion = 0,
    pesoKg = 50,
  ): Record<string, unknown> => ({
    revisionPrescripcion,
    nombre: "Torso ajustado",
    ejercicios: [
      {
        id: randomUUID(),
        ejercicioId,
        indicaciones: "Más lento",
        series: [{ id: randomUUID(), tipoMedicion: "repeticiones", pesoKg, repeticiones: 8 }],
      },
    ],
  })

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
    press = await crearEjercicio(entorno, `${PREFIJO} press`)
    remo = await crearEjercicio(entorno, `${PREFIJO} remo`)
  })

  afterAll(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    await entorno.app.close()
  })

  describe("ajustar una sesión", () => {
    it("cambia solo esa sesión no iniciada y el cliente ve la nueva prescripción", async () => {
      const plan = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(press.id, "2026-09-14", 2, [{ nombre: "Torso", diaSemana: 1 }]),
      )
      const [primera, segunda] = plan.sesiones.map((s) => s.agenda.id)
      const ajustada = SesionEntrenadorSchema.parse(
        (await ajustar(entrenador, primera ?? "", cambio(remo.id)).expect(200)).body,
      )
      expect(ajustada.revisionPrescripcion).toBe(1)
      expect(ajustada.prescripcion).toMatchObject({
        nombre: "Torso ajustado",
        ejercicios: [{ ejercicioId: remo.id, nombre: remo.nombre, indicaciones: "Más lento" }],
      })
      const otra = SesionClienteSchema.parse(
        (
          await request(entorno.servidor())
            .get(`/entrenamiento/sesiones/${segunda ?? ""}`)
            .set("Authorization", cliente.cabecera)
        ).body,
      )
      expect(otra.prescripcion.nombre).toBe("Torso")
      // Un borrador hecho contra la versión anterior se rechaza sin mezclar objetivos.
      const viejo = await request(entorno.servidor())
        .put(`/entrenamiento/sesiones/${primera ?? ""}/borrador`)
        .set("Authorization", cliente.cabecera)
        .send({
          operacionId: randomUUID(),
          revisionPrescripcion: 0,
          revisionBorrador: 0,
          registro: { notas: null, series: [] },
        })
        .expect(409)
      expect(viejo.body.codigo).toBe("prescripcion_cambiada")
    })

    it("no se ajusta una sesión iniciada, enviada o con revisión atrasada", async () => {
      const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, press.id)
      await ajustar(entrenador, id, cambio(press.id, 5)).expect(409)
      await request(entorno.servidor())
        .put(`/entrenamiento/sesiones/${id}/borrador`)
        .set("Authorization", cliente.cabecera)
        .send({
          operacionId: randomUUID(),
          revisionPrescripcion: 0,
          revisionBorrador: 0,
          registro: registroDe(series, [VACIA, VACIA, VACIA]),
        })
        .expect(200)
      const iniciada = await ajustar(entrenador, id, cambio(press.id)).expect(409)
      expect(iniciada.body.codigo).toBe("sesion_iniciada")
    })

    it("el ajuste y el primer guardado compiten: gana uno y nunca se mezclan", async () => {
      for (let vuelta = 0; vuelta < 8; vuelta++) {
        const { id, series } = await sesionDePrueba(
          entorno,
          entrenador,
          cliente.id,
          press.id,
          "2026-10-05",
        )
        const [ajuste, borrador] = await Promise.all([
          ajustar(entrenador, id, cambio(press.id, 0, 60)),
          request(entorno.servidor())
            .put(`/entrenamiento/sesiones/${id}/borrador`)
            .set("Authorization", cliente.cabecera)
            .send({
              operacionId: randomUUID(),
              revisionPrescripcion: 0,
              revisionBorrador: 0,
              registro: registroDe(series, [{ pesoKg: 40, valor: 10, hecha: true }, VACIA, VACIA]),
            }),
        ])
        expect([ajuste.status, borrador.status].sort()).toEqual([200, 409])
        const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
        if (ajuste.status === 200) {
          expect(fila).toMatchObject({ revisionPrescripcion: 1, borrador: null, iniciadaEn: null })
        } else {
          expect(fila.revisionPrescripcion).toBe(0)
          expect(fila.revisionBorrador).toBe(1)
        }
      }
    })

    it("un retirado ya prescrito puede quedarse, uno nuevo no", async () => {
      const { id } = await sesionDePrueba(entorno, entrenador, cliente.id, press.id)
      await entorno.prisma.ejercicio.update({
        where: { id: remo.id },
        data: { estado: "retirado" },
      })
      const nuevo = await ajustar(entrenador, id, cambio(remo.id)).expect(409)
      expect(nuevo.body.codigo).toBe("ejercicio_no_disponible")
      await entorno.prisma.ejercicio.update({
        where: { id: press.id },
        data: { estado: "retirado" },
      })
      await ajustar(entrenador, id, cambio(press.id)).expect(200)
    })

    it("solo el entrenador ajusta", async () => {
      const { id } = await sesionDePrueba(entorno, entrenador, cliente.id, press.id)
      for (const cuenta of [cliente, otroCliente, nutricionista, empleado]) {
        await ajustar(cuenta, id, cambio(press.id)).expect(403)
      }
      await request(entorno.servidor())
        .patch(`/entrenamiento/sesiones/${id}/prescripcion`)
        .send(cambio(press.id))
        .expect(401)
    })
  })

  describe("rutinas guardadas", () => {
    const nombreRutina = `${PREFIJO} Fuerza 3 días`

    async function guardar(): Promise<{ id: string; patron: ReturnType<typeof patronDe> }> {
      const patron = patronDe(press.id, [
        { nombre: "Torso", diaSemana: 1 },
        { nombre: "Pierna", diaSemana: 3 },
      ])
      const respuesta = await request(entorno.servidor())
        .post("/entrenamiento/rutinas")
        .set("Authorization", entrenador.cabecera)
        .send({ nombre: nombreRutina, patron })
        .expect(201)
      return { id: RutinaGuardadaSchema.parse(respuesta.body).id, patron }
    }

    it("guarda, lista, lee y edita con revisión optimista", async () => {
      const { id, patron } = await guardar()
      const listado = ListadoRutinasSchema.parse(
        (
          await request(entorno.servidor())
            .get("/entrenamiento/rutinas")
            .set("Authorization", entrenador.cabecera)
            .expect(200)
        ).body,
      )
      expect(listado.rutinas.some((r) => r.id === id)).toBe(true)
      const editada = await request(entorno.servidor())
        .patch(`/entrenamiento/rutinas/${id}`)
        .set("Authorization", entrenador.cabecera)
        .send({ nombre: `${nombreRutina} v2`, patron, revision: 0 })
        .expect(200)
      expect(editada.body.revision).toBe(1)
      const atrasada = await request(entorno.servidor())
        .patch(`/entrenamiento/rutinas/${id}`)
        .set("Authorization", entrenador.cabecera)
        .send({ nombre: nombreRutina, patron, revision: 0 })
        .expect(409)
      expect(atrasada.body.codigo).toBe("rutina_cambiada")
    })

    it("no admite registros ni notas de clientes ni ejercicios inexistentes", async () => {
      const patron = patronDe(press.id, [{ nombre: "Torso", diaSemana: 1 }])
      await request(entorno.servidor())
        .post("/entrenamiento/rutinas")
        .set("Authorization", entrenador.cabecera)
        .send({ nombre: nombreRutina, patron, registro: { series: [] }, clienteId: cliente.id })
        .expect(400)
      const inexistente = await request(entorno.servidor())
        .post("/entrenamiento/rutinas")
        .set("Authorization", entrenador.cabecera)
        .send({
          nombre: nombreRutina,
          patron: patronDe(randomUUID(), [{ nombre: "Torso", diaSemana: 1 }]),
        })
        .expect(409)
      expect(inexistente.body.codigo).toBe("ejercicio_no_disponible")
    })

    it("asignar desde una rutina y adaptarla después no toca a nadie más", async () => {
      const { id, patron } = await guardar()
      const deUno = await asignar(entorno, entrenador, cliente.id, {
        operacionId: randomUUID(),
        nombre: "Plan de uno",
        semanaInicial: "2026-09-14",
        semanas: 1,
        patron,
      })
      const deOtro = await asignar(entorno, entrenador, otroCliente.id, {
        operacionId: randomUUID(),
        nombre: "Plan de otro",
        semanaInicial: "2026-09-14",
        semanas: 1,
        patron,
      })
      await ajustar(entrenador, deOtro.sesiones[0]?.agenda.id ?? "", cambio(remo.id)).expect(200)
      await request(entorno.servidor())
        .patch(`/entrenamiento/rutinas/${id}`)
        .set("Authorization", entrenador.cabecera)
        .send({
          nombre: nombreRutina,
          patron: patronDe(remo.id, [{ nombre: "Otra", diaSemana: 2 }]),
          revision: 0,
        })
        .expect(200)
      const primera = SesionClienteSchema.parse(
        (
          await request(entorno.servidor())
            .get(`/entrenamiento/sesiones/${deUno.sesiones[0]?.agenda.id ?? ""}`)
            .set("Authorization", cliente.cabecera)
        ).body,
      )
      expect(primera.prescripcion).toMatchObject({
        nombre: "Torso",
        ejercicios: [{ ejercicioId: press.id }],
      })
      expect(primera.revisionPrescripcion).toBe(0)
    })

    it("solo el entrenador usa la biblioteca", async () => {
      const { id, patron } = await guardar()
      for (const cuenta of [cliente, nutricionista, empleado]) {
        await request(entorno.servidor())
          .get("/entrenamiento/rutinas")
          .set("Authorization", cuenta.cabecera)
          .expect(403)
        await request(entorno.servidor())
          .get(`/entrenamiento/rutinas/${id}`)
          .set("Authorization", cuenta.cabecera)
          .expect(403)
        await request(entorno.servidor())
          .post("/entrenamiento/rutinas")
          .set("Authorization", cuenta.cabecera)
          .send({ nombre: nombreRutina, patron })
          .expect(403)
        await request(entorno.servidor())
          .patch(`/entrenamiento/rutinas/${id}`)
          .set("Authorization", cuenta.cabecera)
          .send({ nombre: nombreRutina, patron, revision: 0 })
          .expect(403)
      }
      await request(entorno.servidor()).get("/entrenamiento/rutinas").expect(401)
    })
  })
})
