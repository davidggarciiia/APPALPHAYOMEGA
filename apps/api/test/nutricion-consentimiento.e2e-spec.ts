import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import request from "supertest"
import { VERSION_CONSENTIMIENTO, type DocumentoDieta } from "@alpha-omega/shared"

import { ConsentimientoService } from "../src/identity/consentimiento.service.js"
import { documentoDeObjetivos, entornoNutricion } from "./nutricion-ayuda.js"

const conCalculo = (): DocumentoDieta => ({
  ...documentoDeObjetivos(),
  calculo: {
    pesoKg: 80,
    alturaCm: 180,
    edad: 30,
    sexo: "hombre",
    grasaPct: 20,
    factorActividad: 1.5,
    nota: null,
  },
})

describe("Dieta con cálculo: consentimiento en la misma transacción", () => {
  let e: Awaited<ReturnType<typeof entornoNutricion>>
  const http = () => e.app.getHttpServer()
  const ruta = () => `/nutricion/clientes/${e.ids.cliente}/borrador`
  const retirar = () => request(http()).delete("/consentimiento").set(e.como("cliente")).expect(200)
  const guardar = (revision: number, documento = conCalculo()) =>
    request(http()).put(ruta()).set(e.como("entrenador")).send({ revision, documento })
  beforeAll(async () => {
    e = await entornoNutricion("consentimiento-production-20261027")
  })
  beforeEach(async () => {
    await e.prisma.dieta.deleteMany({ where: { clienteId: e.ids.cliente } })
    await request(http())
      .post("/consentimiento")
      .set(e.como("cliente"))
      .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
      .expect(201)
  })
  afterAll(async () => {
    await e?.cerrar()
  })

  it.each([
    ["crear", "anterior"],
    ["actualizar", "anterior"],
    ["publicar", "anterior"],
    ["crear", "simultanea"],
    ["actualizar", "simultanea"],
    ["publicar", "simultanea"],
  ] as const)("rechaza %s tras retirada %s sin escribir ni archivar", async (accion, momento) => {
    if (accion !== "crear") await guardar(0).expect(200)
    const inicial = await e.prisma.dieta.findMany({ where: { clienteId: e.ids.cliente } })
    if (momento === "anterior") await retirar()
    const consentimiento = e.app.get(ConsentimientoService)
    const exigir = consentimiento.exigirVigente.bind(consentimiento)
    let avisar = () => {}
    let liberar = () => {}
    const dentro = new Promise<void>((resolver) => {
      avisar = resolver
    })
    const pausa = new Promise<void>((resolver) => {
      liberar = resolver
    })
    const espia =
      momento === "simultanea"
        ? jest.spyOn(consentimiento, "exigirVigente").mockImplementationOnce(async (...args) => {
            avisar()
            await pausa
            return exigir(...args)
          })
        : null
    const peticion =
      accion === "publicar"
        ? request(http())
            .post(`${ruta()}/publicar`)
            .set(e.como("entrenador"))
            .send({ revision: 1, operacionId: randomUUID() })
        : guardar(accion === "crear" ? 0 : 1)
    const pendiente = peticion.on("response", avisar).then((respuesta) => respuesta)
    try {
      if (momento === "simultanea") {
        await dentro
        await retirar()
        liberar()
      }
      const respuesta = await pendiente
      expect(respuesta.status).toBe(409)
      expect(respuesta.body.codigo).toBe("consentimiento_pendiente")
      expect(await e.prisma.dieta.findMany({ where: { clienteId: e.ids.cliente } })).toEqual(
        inicial,
      )
    } finally {
      liberar()
      await pendiente
      espia?.mockRestore()
    }
  })

  it("permite preparar una prescripción sin cálculo para un cliente pendiente", async () => {
    await request(http())
      .put(`/nutricion/clientes/${e.ids.pendiente}/borrador`)
      .set(e.como("entrenador"))
      .send({ revision: 0, documento: documentoDeObjetivos() })
      .expect(200)
  })

  it("rechaza un cálculo cuando el cliente nunca aceptó el consentimiento", async () => {
    await e.prisma.consentimientoSalud.deleteMany({ where: { usuarioId: e.ids.cliente } })
    const respuesta = await guardar(0).expect(409)
    expect(respuesta.body.codigo).toBe("consentimiento_pendiente")
    expect(await e.prisma.dieta.count({ where: { clienteId: e.ids.cliente } })).toBe(0)
  })

  it("repetir una publicación confirmada conserva la idempotencia tras retirar el consentimiento", async () => {
    await guardar(0).expect(200)
    const datos = { revision: 1, operacionId: randomUUID() }
    const publicar = () =>
      request(http()).post(`${ruta()}/publicar`).set(e.como("entrenador")).send(datos).expect(200)
    const primera = await publicar()
    await retirar()
    expect((await publicar()).body).toEqual(primera.body)
    expect(await e.prisma.dieta.count({ where: { clienteId: e.ids.cliente } })).toBe(1)
  })

  it("conserva la lectura de columnas legacy duplicadas y exige corregirlas antes de publicar", async () => {
    const documento = documentoDeObjetivos("Documento anterior")
    documento.tiposDeDia[0]!.comidas = [
      {
        id: randomUUID(),
        nombre: "Comida",
        hora: null,
        indicacion: null,
        forma: "intercambio",
        columnas: [
          { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: null }] },
          { nombre: "Proteína", alimentos: [{ nombre: "Tofu", cantidad: null }] },
        ],
      },
    ]
    const borrador = await e.prisma.dieta.create({
      data: {
        clienteId: e.ids.cliente,
        creadaPorId: e.ids.entrenador,
        estado: "borrador",
        revision: 1,
        documento,
      },
    })
    const anterior = await e.prisma.dieta.create({
      data: {
        clienteId: e.ids.cliente,
        creadaPorId: e.ids.entrenador,
        publicadaPorId: e.ids.entrenador,
        estado: "publicada",
        revision: 1,
        publicadaEn: new Date(),
        documento,
      },
    })
    const base = `/nutricion/clientes/${e.ids.cliente}`
    for (const ruta of ["borrador", "dieta", "historico", `dietas/${anterior.id}`]) {
      await request(http()).get(`${base}/${ruta}`).set(e.como("entrenador")).expect(200)
    }
    const publicar = () =>
      request(http())
        .post(`${base}/borrador/publicar`)
        .set(e.como("entrenador"))
        .send({ revision: 1, operacionId: randomUUID() })
    const rechazada = await publicar().expect(409)
    expect(rechazada.body.message).toContain("columnas")
    expect((await e.prisma.dieta.findUniqueOrThrow({ where: { id: anterior.id } })).estado).toBe(
      "publicada",
    )
    expect((await e.prisma.dieta.findUniqueOrThrow({ where: { id: borrador.id } })).estado).toBe(
      "borrador",
    )
    const comida = documento.tiposDeDia[0]!.comidas[0]!
    if (comida.forma !== "intercambio") throw new Error("Fixture inválido")
    comida.columnas[1]!.nombre = "Proteína vegetal"
    await guardar(1, documento).expect(200)
    await request(http())
      .post(`${base}/borrador/publicar`)
      .set(e.como("entrenador"))
      .send({ revision: 2, operacionId: randomUUID() })
      .expect(200)
  })
})
