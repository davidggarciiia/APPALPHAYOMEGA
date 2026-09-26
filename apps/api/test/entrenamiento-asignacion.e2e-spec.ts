import {
  ListadoEjerciciosSchema,
  ListadoPlanesSchema,
  ListadoSesionesSchema,
  PanelSemanalSchema,
  ResultadoAnulacionSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
} from "@alpha-omega/shared"
import request from "supertest"

import {
  ID_INEXISTENTE,
  asignar,
  crearCuenta,
  crearEjercicio,
  crearPendiente,
  levantar,
  limpiar,
  planDe,
  type Cuenta,
  type Entorno,
} from "./ayudantes.js"

const SUFIJO = "@e2e-asignacion.test"
const PREFIJO = "e2e-asignacion"

describe("Entrenamiento: asignación y lecturas", () => {
  let entorno: Entorno
  let entrenador: Cuenta
  let cliente: Cuenta
  let otroCliente: Cuenta
  let nutricionista: Cuenta
  let empleado: Cuenta
  let ejercicio: { id: string; nombre: string }

  const post = (cuenta: Cuenta, ruta: string, cuerpo: unknown): request.Test =>
    request(entorno.servidor())
      .post(ruta)
      .set("Authorization", cuenta.cabecera)
      .send(cuerpo as object)
  const get = (cuenta: Cuenta, ruta: string): request.Test =>
    request(entorno.servidor()).get(ruta).set("Authorization", cuenta.cabecera)

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
    ejercicio = await crearEjercicio(entorno, `${PREFIJO} press`)
  })

  afterAll(async () => {
    await limpiar(entorno, SUFIJO, PREFIJO)
    await entorno.app.close()
  })

  it("asigna un patrón de dos sesiones durante tres semanas con las fechas correctas", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 3, [
        { nombre: "Pierna", diaSemana: 4 },
        { nombre: "Torso", diaSemana: 1 },
      ]),
    )
    expect(plan.sesiones.map((s) => [s.nombre, s.agenda.fechaOriginal])).toEqual([
      ["Torso", "2026-09-14"],
      ["Pierna", "2026-09-17"],
      ["Torso", "2026-09-21"],
      ["Pierna", "2026-09-24"],
      ["Torso", "2026-09-28"],
      ["Pierna", "2026-10-01"],
    ])
    const listado = await get(cliente, `/entrenamiento/clientes/${cliente.id}/sesiones`)
      .query({ semana: "2026-09-21", semanas: 2 })
      .expect(200)
    expect(ListadoSesionesSchema.parse(listado.body).total).toBe(4)
  })

  it("el cliente abre su sesión con borrador vacío y el entrenador sin borrador", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const id = plan.sesiones[0]?.agenda.id ?? ""
    const propia = SesionClienteSchema.parse(
      (await get(cliente, `/entrenamiento/sesiones/${id}`).expect(200)).body,
    )
    expect(propia.borrador).toBeNull()
    expect(propia.prescripcion.ejercicios[0]?.nombre).toBe(ejercicio.nombre)
    const vista = await get(entrenador, `/entrenamiento/sesiones/${id}`).expect(200)
    expect(SesionEntrenadorSchema.parse(vista.body).permiteAjuste).toBe(true)
    expect(vista.body).not.toHaveProperty("borrador")
    const fichas = await get(cliente, `/entrenamiento/sesiones/${id}/ejercicios`).expect(200)
    expect(ListadoEjerciciosSchema.parse(fichas.body).ejercicios.map((e) => e.id)).toEqual([
      ejercicio.id,
    ])
    await get(cliente, `/entrenamiento/sesiones/${id}/resultado`).expect(404)
  })

  it("la prescripción conserva el nombre del ejercicio aunque luego se renombre o retire", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    await entorno.prisma.ejercicio.update({
      where: { id: ejercicio.id },
      data: { nombre: `${PREFIJO} renombrado`, estado: "retirado" },
    })
    const id = plan.sesiones[0]?.agenda.id ?? ""
    const sesion = SesionClienteSchema.parse(
      (await get(cliente, `/entrenamiento/sesiones/${id}`)).body,
    )
    expect(sesion.prescripcion.ejercicios[0]?.nombre).toBe(ejercicio.nombre)
  })

  it("se puede asignar a un cliente pendiente, no a uno de baja ni a quien no es cliente", async () => {
    const pendiente = await crearPendiente(entorno, "pendiente", SUFIJO)
    await asignar(
      entorno,
      entrenador,
      pendiente,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    await entorno.prisma.usuario.update({
      where: { id: otroCliente.id },
      data: { estado: "desactivado" },
    })
    const baja = await post(
      entrenador,
      `/entrenamiento/clientes/${otroCliente.id}/planes`,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
    ).expect(409)
    expect(baja.body.codigo).toBe("cliente_no_disponible")
    for (const id of [nutricionista.id, ID_INEXISTENTE]) {
      await post(
        entrenador,
        `/entrenamiento/clientes/${id}/planes`,
        planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      ).expect(404)
    }
    expect(
      await entorno.prisma.sesionProgramada.count({ where: { clienteId: otroCliente.id } }),
    ).toBe(0)
  })

  it("un ejercicio retirado o inexistente no entra en un plan nuevo", async () => {
    const retirado = await crearEjercicio(entorno, `${PREFIJO} retirado`)
    await entorno.prisma.ejercicio.update({
      where: { id: retirado.id },
      data: { estado: "retirado" },
    })
    for (const id of [retirado.id, ID_INEXISTENTE]) {
      const respuesta = await post(
        entrenador,
        `/entrenamiento/clientes/${cliente.id}/planes`,
        planDe(id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      ).expect(409)
      expect(respuesta.body).toMatchObject({ codigo: "ejercicio_no_disponible", ids: [id] })
    }
    expect(await entorno.prisma.planEntrenamiento.count({ where: { clienteId: cliente.id } })).toBe(
      0,
    )
  })

  it("reintentar la misma asignación no duplica; otro contenido con el mismo id es 409", async () => {
    const cuerpo = planDe(ejercicio.id, "2026-09-14", 2, [{ nombre: "Torso", diaSemana: 1 }])
    const primera = await asignar(entorno, entrenador, cliente.id, cuerpo)
    const segunda = await asignar(entorno, entrenador, cliente.id, cuerpo)
    expect(segunda).toEqual(primera)
    const distinta = await post(entrenador, `/entrenamiento/clientes/${cliente.id}/planes`, {
      ...cuerpo,
      semanas: 3,
    }).expect(409)
    expect(distinta.body.codigo).toBe("operacion_reutilizada")
    await post(entrenador, `/entrenamiento/clientes/${otroCliente.id}/planes`, cuerpo).expect(409)
    expect(await entorno.prisma.sesionProgramada.count({ where: { clienteId: cliente.id } })).toBe(
      2,
    )
  })

  it("cinco asignaciones idénticas a la vez crean un solo plan y responden lo mismo", async () => {
    const cuerpo = planDe(ejercicio.id, "2026-09-14", 4, [
      { nombre: "Torso", diaSemana: 1 },
      { nombre: "Pierna", diaSemana: 3 },
    ])
    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () =>
        post(entrenador, `/entrenamiento/clientes/${cliente.id}/planes`, cuerpo),
      ),
    )
    expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    expect(new Set(respuestas.map((r) => JSON.stringify(r.body))).size).toBe(1)
    expect(await entorno.prisma.planEntrenamiento.count({ where: { clienteId: cliente.id } })).toBe(
      1,
    )
    expect(await entorno.prisma.sesionProgramada.count({ where: { clienteId: cliente.id } })).toBe(
      8,
    )
  })

  it("sesiones de dos planes en las mismas fechas coexisten", async () => {
    await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "A", diaSemana: 1 }]),
    )
    await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "B", diaSemana: 1 }]),
    )
    const listado = await get(entrenador, `/entrenamiento/clientes/${cliente.id}/sesiones`)
      .query({ semana: "2026-09-14" })
      .expect(200)
    expect(ListadoSesionesSchema.parse(listado.body).sesiones.map((s) => s.nombre)).toEqual([
      "A",
      "B",
    ])
  })

  it("el panel reúne a todos los clientes de la semana y filtra por uno", async () => {
    await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "A", diaSemana: 2 }]),
    )
    await asignar(
      entorno,
      entrenador,
      otroCliente.id,
      planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "B", diaSemana: 1 }]),
    )
    const todos = PanelSemanalSchema.parse(
      (await get(entrenador, "/entrenamiento/sesiones").query({ semana: "2026-09-14" }).expect(200))
        .body,
    )
    const nuestras = todos.sesiones.filter((s) =>
      [cliente.id, otroCliente.id].includes(s.cliente.id),
    )
    expect(nuestras.map((s) => [s.cliente.nombre, s.nombre, s.ejecucion])).toEqual([
      ["otro", "B", null],
      ["cliente", "A", null],
    ])
    const uno = PanelSemanalSchema.parse(
      (
        await get(entrenador, "/entrenamiento/sesiones")
          .query({ semana: "2026-09-14", clienteId: cliente.id })
          .expect(200)
      ).body,
    )
    expect(uno.sesiones.map((s) => s.nombre)).toEqual(["A"])
  })

  it("anula sesiones no iniciadas y conserva las empezadas", async () => {
    const plan = await asignar(
      entorno,
      entrenador,
      cliente.id,
      planDe(ejercicio.id, "2026-09-14", 3, [{ nombre: "Torso", diaSemana: 1 }]),
    )
    const [primera, segunda] = plan.sesiones.map((s) => s.agenda.id)
    await request(entorno.servidor())
      .delete(`/entrenamiento/sesiones/${primera ?? ""}`)
      .set("Authorization", entrenador.cabecera)
      .expect(204)
    await request(entorno.servidor())
      .delete(`/entrenamiento/sesiones/${primera ?? ""}`)
      .set("Authorization", entrenador.cabecera)
      .expect(404)
    await entorno.prisma.sesionEntrenamiento.update({
      where: { id: segunda ?? "" },
      data: { iniciadaEn: new Date() },
    })
    const empezada = await request(entorno.servidor())
      .delete(`/entrenamiento/sesiones/${segunda ?? ""}`)
      .set("Authorization", entrenador.cabecera)
      .expect(409)
    expect(empezada.body.codigo).toBe("sesion_iniciada")
    const vista = SesionEntrenadorSchema.parse(
      (await get(entrenador, `/entrenamiento/sesiones/${segunda ?? ""}`)).body,
    )
    expect(vista.permiteAjuste).toBe(false)

    const planes = ListadoPlanesSchema.parse(
      (await get(entrenador, `/entrenamiento/clientes/${cliente.id}/planes`).expect(200)).body,
    )
    expect(planes.planes[0]).toMatchObject({
      sesionesTotales: 2,
      sesionesSinIniciar: 1,
      sesionesEnviadas: 0,
    })

    const anulacion = await post(entrenador, `/entrenamiento/planes/${plan.id}/anular`, {}).expect(
      200,
    )
    expect(ResultadoAnulacionSchema.parse(anulacion.body)).toEqual({ anuladas: 1, conservadas: 1 })
    expect(await entorno.prisma.sesionProgramada.count({ where: { clienteId: cliente.id } })).toBe(
      1,
    )
  })

  describe("denegaciones", () => {
    it("otro cliente no ve ni la semana ni las sesiones ajenas", async () => {
      const plan = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      )
      const id = plan.sesiones[0]?.agenda.id ?? ""
      await get(otroCliente, `/entrenamiento/clientes/${cliente.id}/sesiones`)
        .query({ semana: "2026-09-14" })
        .expect(403)
      for (const ruta of ["", "/ejercicios", "/resultado"]) {
        await get(otroCliente, `/entrenamiento/sesiones/${id}${ruta}`).expect(404)
      }
    })

    it("el cliente no asigna, no anula, no ve planes ni el panel", async () => {
      const plan = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      )
      const id = plan.sesiones[0]?.agenda.id ?? ""
      await post(
        cliente,
        `/entrenamiento/clientes/${cliente.id}/planes`,
        planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      ).expect(403)
      await get(cliente, `/entrenamiento/clientes/${cliente.id}/planes`).expect(403)
      await get(cliente, "/entrenamiento/sesiones").query({ semana: "2026-09-14" }).expect(403)
      await request(entorno.servidor())
        .delete(`/entrenamiento/sesiones/${id}`)
        .set("Authorization", cliente.cabecera)
        .expect(403)
      await post(cliente, `/entrenamiento/planes/${plan.id}/anular`, {}).expect(403)
    })

    it("nutricionista y empleado no llegan a ninguna ruta; sin sesión es 401", async () => {
      const plan = await asignar(
        entorno,
        entrenador,
        cliente.id,
        planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }]),
      )
      const id = plan.sesiones[0]?.agenda.id ?? ""
      await entorno.prisma.asignacionNutricionista.create({
        data: { nutricionistaId: nutricionista.id, clienteId: cliente.id },
      })
      const lecturas = [
        `/entrenamiento/clientes/${cliente.id}/sesiones?semana=2026-09-14`,
        `/entrenamiento/clientes/${cliente.id}/planes`,
        "/entrenamiento/sesiones?semana=2026-09-14",
        `/entrenamiento/sesiones/${id}`,
        `/entrenamiento/sesiones/${id}/ejercicios`,
        `/entrenamiento/sesiones/${id}/resultado`,
      ]
      for (const ruta of lecturas) {
        for (const cuenta of [nutricionista, empleado]) {
          await get(cuenta, ruta).expect(403)
        }
        await request(entorno.servidor()).get(ruta).expect(401)
      }
      const cuerpo = planDe(ejercicio.id, "2026-09-14", 1, [{ nombre: "Torso", diaSemana: 1 }])
      for (const cuenta of [nutricionista, empleado]) {
        await post(cuenta, `/entrenamiento/clientes/${cliente.id}/planes`, cuerpo).expect(403)
        await post(cuenta, `/entrenamiento/planes/${plan.id}/anular`, {}).expect(403)
        await request(entorno.servidor())
          .delete(`/entrenamiento/sesiones/${id}`)
          .set("Authorization", cuenta.cabecera)
          .expect(403)
      }
      await request(entorno.servidor())
        .post(`/entrenamiento/clientes/${cliente.id}/planes`)
        .send(cuerpo)
        .expect(401)
      expect(
        await entorno.prisma.sesionProgramada.count({ where: { clienteId: cliente.id } }),
      ).toBe(1)
    })
  })
})
