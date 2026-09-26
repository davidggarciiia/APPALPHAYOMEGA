import { BorradorSchema, RespuestaBorradorSchema, SesionClienteSchema } from "@alpha-omega/shared"
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

const SUFIJO = "@e2e-borrador.test"
const PREFIJO = "e2e-borrador"
const CENTINELA = "CENTINELA-PRIVADO"

describe("Entrenamiento: borrador privado", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let otroCliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta
  let ejercicioId: string

  const guardar = (cuenta: Cuenta, id: string, cuerpo: Record<string, unknown>): request.Test =>
    request(entorno.servidor())
      .put(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", cuenta.cabecera)
      .send(cuerpo)
  const cuerpo = (
    registro: unknown,
    revisionBorrador = 0,
    revisionPrescripcion = 0,
  ): Record<string, unknown> => ({
    operacionId: randomUUID(),
    revisionPrescripcion,
    revisionBorrador,
    registro,
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
    ejercicioId = (await crearEjercicio(entorno, `${PREFIJO} press`)).id
  })

  afterAll(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    await entorno.app.close()
  })

  it("guarda campos vacíos sin convertirlos en ceros y lo recupera", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const registro = registroDe(series, [{ pesoKg: 42.5, valor: null, hecha: false }, VACIA, VACIA])
    const guardado = BorradorSchema.parse(
      (await guardar(cliente, id, cuerpo(registro)).expect(200)).body,
    )
    expect(guardado).toMatchObject({ revision: 1, revisionPrescripcion: 0, registro })

    const sesion = SesionClienteSchema.parse(
      (
        await request(entorno.servidor())
          .get(`/entrenamiento/sesiones/${id}`)
          .set("Authorization", cliente.cabecera)
      ).body,
    )
    expect(sesion.borrador?.registro).toEqual(registro)
    // El objetivo sigue siendo el objetivo.
    expect(sesion.prescripcion.ejercicios[0]?.series[0]).toMatchObject({
      pesoKg: 40,
      repeticiones: 10,
    })
    const leido = await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", cliente.cabecera)
      .expect(200)
    expect(RespuestaBorradorSchema.parse(leido.body).borrador?.revision).toBe(1)
  })

  it("valores distintos del objetivo, peso cero y tiempo sin carga se aceptan", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const registro = registroDe(series, [
      { pesoKg: 37.5, valor: 12, hecha: true },
      { pesoKg: 0, valor: 6, hecha: true },
      { pesoKg: null, valor: 60, hecha: true },
    ])
    await guardar(cliente, id, cuerpo(registro)).expect(200)
  })

  it("rechaza marcar sin valor, sin la carga prescrita, unidades cambiadas o series ajenas", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const ajena = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId, "2026-09-21")
    const invalidos = [
      registroDe(series, [{ pesoKg: 40, valor: null, hecha: true }, VACIA, VACIA]),
      registroDe(series, [{ pesoKg: null, valor: 10, hecha: true }, VACIA, VACIA]),
      {
        notas: null,
        series: [
          { serieId: series[0], tipoMedicion: "tiempo", pesoKg: 40, segundos: 30, hecha: true },
        ],
      },
      registroDe(ajena.series, [{ pesoKg: 40, valor: 10, hecha: true }, VACIA, VACIA]),
      {
        notas: null,
        series: [
          {
            serieId: series[0],
            tipoMedicion: "repeticiones",
            pesoKg: 40,
            repeticiones: 10,
            segundos: 30,
            hecha: true,
          },
        ],
      },
      registroDe(series, [{ pesoKg: -1, valor: 10, hecha: true }, VACIA, VACIA]),
      registroDe(series, [{ pesoKg: 40, valor: 2.5, hecha: true }, VACIA, VACIA]),
    ]
    for (const registro of invalidos) {
      await guardar(cliente, id, cuerpo(registro)).expect(400)
    }
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.revisionBorrador).toBe(0)
    expect(fila.borrador).toBeNull()
  })

  it("una revisión atrasada no pisa la nueva; repetir la operación devuelve lo mismo", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const primero = cuerpo(
      registroDe(series, [{ pesoKg: 40, valor: 10, hecha: true }, VACIA, VACIA]),
    )
    const a = await guardar(cliente, id, primero).expect(200)
    const repetido = await guardar(cliente, id, primero).expect(200)
    expect(repetido.body).toEqual(a.body)
    const reutilizado = await guardar(cliente, id, {
      ...primero,
      registro: registroDe(series, [{ pesoKg: 50, valor: 10, hecha: true }, VACIA, VACIA]),
    }).expect(409)
    expect(reutilizado.body.codigo).toBe("operacion_reutilizada")

    // Otro dispositivo con la revisión 0.
    const atrasado = await guardar(
      cliente,
      id,
      cuerpo(registroDe(series, [{ pesoKg: 99, valor: 1, hecha: true }, VACIA, VACIA])),
    ).expect(409)
    expect(atrasado.body).toMatchObject({ codigo: "borrador_cambiado", revisionBorrador: 1 })
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.revisionBorrador).toBe(1)
  })

  it("dos guardados simultáneos de la misma revisión: uno gana y el otro recibe 409", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const respuestas = await Promise.all(
      [10, 11, 12].map((valor) =>
        guardar(
          cliente,
          id,
          cuerpo(registroDe(series, [{ pesoKg: 40, valor, hecha: true }, VACIA, VACIA])),
        ),
      ),
    )
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409, 409])
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.revisionBorrador).toBe(1)
  })

  it("el entrenador no ve nada del borrador en ninguna respuesta", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await guardar(
      cliente,
      id,
      cuerpo(
        registroDe(series, [{ pesoKg: 123.45, valor: 77, hecha: true }, VACIA, VACIA], CENTINELA),
      ),
    ).expect(200)

    await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", entrenador.cabecera)
      .expect(403)
    await guardar(entrenador, id, cuerpo({ notas: null, series: [] })).expect(403)

    const lecturas = [
      `/entrenamiento/sesiones/${id}`,
      `/entrenamiento/sesiones/${id}/ejercicios`,
      `/entrenamiento/clientes/${cliente.id}/sesiones?semana=2026-09-14`,
      `/entrenamiento/clientes/${cliente.id}/planes`,
      "/entrenamiento/sesiones?semana=2026-09-14",
      `/entrenamiento/sesiones?semana=2026-09-14&clienteId=${cliente.id}`,
      `/agenda/sesiones/${id}/cambios`,
    ]
    for (const ruta of lecturas) {
      const respuesta = await request(entorno.servidor())
        .get(ruta)
        .set("Authorization", entrenador.cabecera)
        .expect(200)
      const texto = JSON.stringify(respuesta.body)
      expect(texto).not.toContain(CENTINELA)
      expect(texto).not.toContain("123.45")
      expect(texto).not.toContain("revisionBorrador")
      expect(texto).not.toContain('"borrador"')
    }
    await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/resultado`)
      .set("Authorization", entrenador.cabecera)
      .expect(404)
  })

  it("el primer guardado impide que el entrenador ajuste la sesión", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await guardar(cliente, id, cuerpo(registroDe(series, [VACIA, VACIA, VACIA]))).expect(200)
    const vista = await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}`)
      .set("Authorization", entrenador.cabecera)
      .expect(200)
    expect(vista.body.permiteAjuste).toBe(false)
  })

  it("otro cliente recibe 404; nutricionista y empleado 403; sin sesión 401", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    const registro = registroDe(series, [VACIA, VACIA, VACIA])
    await guardar(otroCliente, id, cuerpo(registro)).expect(404)
    await request(entorno.servidor())
      .get(`/entrenamiento/sesiones/${id}/borrador`)
      .set("Authorization", otroCliente.cabecera)
      .expect(404)
    for (const cuenta of [nutricionista, empleado]) {
      await guardar(cuenta, id, cuerpo(registro)).expect(403)
      await request(entorno.servidor())
        .get(`/entrenamiento/sesiones/${id}/borrador`)
        .set("Authorization", cuenta.cabecera)
        .expect(403)
    }
    await request(entorno.servidor())
      .put(`/entrenamiento/sesiones/${id}/borrador`)
      .send(cuerpo(registro))
      .expect(401)
    await request(entorno.servidor()).get(`/entrenamiento/sesiones/${id}/borrador`).expect(401)
    const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
    expect(fila.borrador).toBeNull()
  })

  it("una cuenta desactivada ya no puede guardar", async () => {
    const { id, series } = await sesionDePrueba(entorno, entrenador, cliente.id, ejercicioId)
    await entorno.prisma.usuario.update({
      where: { id: cliente.id },
      data: { estado: "desactivado" },
    })
    await guardar(cliente, id, cuerpo(registroDe(series, [VACIA, VACIA, VACIA]))).expect(401)
  })
})
