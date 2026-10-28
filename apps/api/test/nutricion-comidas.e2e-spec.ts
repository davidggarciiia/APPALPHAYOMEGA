import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import request from "supertest"
import type { Prisma } from "@prisma/client"
import {
  BorradorDietaSchema,
  ComidaRegistradaSchema,
  DietaPublicadaSchema,
  LecturaDietaVigenteSchema,
  ListadoComidasRegistradasSchema,
  ZONA_AGENDA,
  type DocumentoDieta,
  ErrorDeApiSchema,
  VERSION_CONSENTIMIENTO,
} from "@alpha-omega/shared"
import { entornoNutricion } from "./nutricion-ayuda.js"
import { ConsentimientoService } from "../src/identity/consentimiento.service.js"
import { DietasService } from "../src/nutricion/dietas.service.js"
import { ComidasService } from "../src/nutricion/comidas.service.js"
import { esperarPausa } from "./concurrencia-ayuda.js"

const TIPO = "00000000-0000-4000-8000-000000000010"
const DESAYUNO = "00000000-0000-4000-8000-000000000011"
const TORTITAS = "00000000-0000-4000-8000-000000000012"
const COMIDA = "00000000-0000-4000-8000-000000000013"

function documento(): DocumentoDieta {
  return {
    formato: 1,
    nombre: "Dieta con comidas",
    tiposDeDia: [
      {
        id: TIPO,
        nombre: "Todos",
        objetivo: { kcal: 3250, proteinaG: 203, hidratosG: 366, grasaG: 108 },
        margenKcal: 100,
        comidas: [
          {
            id: DESAYUNO,
            nombre: "Media mañana",
            hora: "11:00",
            indicacion: "Café o infusión libre",
            forma: "alternativas",
            grupos: [
              {
                nombre: "Dulces",
                alternativas: [
                  {
                    id: TORTITAS,
                    titulo: "Tortitas de avena",
                    alimentos: [{ nombre: "Avena", cantidad: "40 g" }],
                    nota: null,
                    macros: null,
                  },
                ],
              },
            ],
          },
          {
            id: COMIDA,
            nombre: "Comida",
            hora: "14:00",
            indicacion: "Verdura libre",
            forma: "intercambio",
            columnas: [
              { nombre: "Hidrato", alimentos: [{ nombre: "Arroz blanco", cantidad: "50 g" }] },
              { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: "150 g" }] },
            ],
          },
        ],
      },
    ],
    semana: Array.from({ length: 7 }, () => TIPO),
    indicaciones: [{ titulo: "2 L + 1 L", texto: "agua y entreno" }],
    suplementos: [{ nombre: "Creatina", dosis: "3–5 g" }],
    nota: "Mantén la proteína alta.",
    registroComidas: true,
    calculo: {
      pesoKg: 112.2,
      alturaCm: 196,
      edad: 21,
      sexo: "hombre",
      grasaPct: 29.2,
      factorActividad: 1.55,
      nota: null,
    },
  }
}

const hoy = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())

describe("Comidas hechas", () => {
  let entorno: Awaited<ReturnType<typeof entornoNutricion>>
  let dietaId: string
  beforeAll(async () => {
    entorno = await entornoNutricion("comidas")
    const { app, como, ids } = entorno
    const base = `/nutricion/clientes/${ids.cliente}`
    const borrador = BorradorDietaSchema.parse(
      (
        await request(app.getHttpServer())
          .put(`${base}/borrador`)
          .set(como("nutricionista"))
          .send({ revision: 0, documento: documento() })
          .expect(200)
      ).body,
    )
    dietaId = DietaPublicadaSchema.parse(
      (
        await request(app.getHttpServer())
          .post(`${base}/borrador/publicar`)
          .set(como("nutricionista"))
          .send({ operacionId: randomUUID(), revision: borrador.revision })
          .expect(200)
      ).body,
    ).id
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const ruta = (resto: string) => `/nutricion/clientes/${entorno.ids.cliente}/${resto}`

  it("el cliente ve que la dieta es de su nutricionista, con sus campos nuevos", async () => {
    const leida = LecturaDietaVigenteSchema.parse(
      (await request(entorno.app.getHttpServer()).get(ruta("dieta")).set(entorno.como("cliente")))
        .body,
    )
    expect(leida.deNutricionista).toBe(true)
    expect(leida.dieta?.documento.suplementos).toEqual([{ nombre: "Creatina", dosis: "3–5 g" }])
    expect(leida.dieta?.documento.tiposDeDia[0]?.margenKcal).toBe(100)
  })

  it("marca una alternativa y un plato, los lista y los quita", async () => {
    const { app, como } = entorno
    const http = app.getHttpServer()
    const alternativa = ComidaRegistradaSchema.parse(
      (
        await request(http)
          .put(ruta(`comidas/${hoy()}/${DESAYUNO}`))
          .set(como("cliente"))
          .send({ dietaId, eleccion: { tipo: "alternativa", alternativaId: TORTITAS } })
          .expect(200)
      ).body,
    )
    expect(alternativa.eleccion).toEqual({ tipo: "alternativa", alternativaId: TORTITAS })
    await request(http)
      .put(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(como("cliente"))
      .send({
        dietaId,
        eleccion: {
          tipo: "plato",
          elegidos: [
            { columna: "Hidrato", alimento: "Arroz blanco" },
            { columna: "Proteína", alimento: "Pollo" },
          ],
        },
      })
      .expect(200)
    const listado = ListadoComidasRegistradasSchema.parse(
      (
        await request(http)
          .get(ruta(`comidas?desde=${hoy()}&hasta=${hoy()}`))
          .set(como("nutricionista"))
          .expect(200)
      ).body,
    )
    expect(listado.comidas.map((c) => c.comidaId).sort()).toEqual([DESAYUNO, COMIDA].sort())

    await request(http)
      .delete(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(como("cliente"))
      .expect(204)
    const tras = ListadoComidasRegistradasSchema.parse(
      (
        await request(http)
          .get(ruta(`comidas?desde=${hoy()}&hasta=${hoy()}`))
          .set(como("cliente"))
          .expect(200)
      ).body,
    )
    expect(tras.comidas.map((c) => c.comidaId)).toEqual([DESAYUNO])
  })

  it("rechaza opciones que no son de esa comida y dietas que ya cambiaron", async () => {
    const { app, como } = entorno
    const http = app.getHttpServer()
    await request(http)
      .put(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(como("cliente"))
      .send({ dietaId, eleccion: { tipo: "alternativa", alternativaId: TORTITAS } })
      .expect(400)
    await request(http)
      .put(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(como("cliente"))
      .send({
        dietaId,
        eleccion: { tipo: "plato", elegidos: [{ columna: "Hidrato", alimento: "Pizza" }] },
      })
      .expect(400)
    await request(http)
      .put(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(como("cliente"))
      .send({ dietaId: randomUUID(), eleccion: { tipo: "hecha" } })
      .expect(409)
  })

  it("solo el cliente marca, y solo lo suyo", async () => {
    const { app, como, ids } = entorno
    const http = app.getHttpServer()
    await request(http)
      .put(ruta(`comidas/${hoy()}/${DESAYUNO}`))
      .set(como("nutricionista"))
      .send({ dietaId, eleccion: { tipo: "hecha" } })
      .expect(403)
    await request(http)
      .put(`/nutricion/clientes/${ids.otro}/comidas/${hoy()}/${DESAYUNO}`)
      .set(como("cliente"))
      .send({ dietaId, eleccion: { tipo: "hecha" } })
      .expect(403)
    await request(http)
      .get(ruta(`comidas?desde=${hoy()}&hasta=${hoy()}`))
      .set(como("nutriAjeno"))
      .expect(403)
  })
})

describe("Comidas: pauta vigente y escrituras concurrentes", () => {
  let entorno: Awaited<ReturnType<typeof entornoNutricion>>
  let dietaId: string
  beforeAll(async () => {
    entorno = await entornoNutricion("comidas-integridad")
    dietaId = (await publicarDocumento(documento())).id
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })
  const ruta = (resto: string) => `/nutricion/clientes/${entorno.ids.cliente}/${resto}`
  async function crearBorrador(doc: DocumentoDieta) {
    return BorradorDietaSchema.parse(
      (
        await request(entorno.app.getHttpServer())
          .put(ruta("borrador"))
          .set(entorno.como("nutricionista"))
          .send({ revision: 0, documento: doc })
          .expect(200)
      ).body,
    )
  }
  const publicar = (revision: number) =>
    request(entorno.app.getHttpServer())
      .post(ruta("borrador/publicar"))
      .set(entorno.como("nutricionista"))
      .send({ operacionId: randomUUID(), revision })
  async function publicarDocumento(doc: DocumentoDieta) {
    const borrador = await crearBorrador(doc)
    return DietaPublicadaSchema.parse((await publicar(borrador.revision).expect(200)).body)
  }
  const marcar = (eleccion: Record<string, unknown> = { tipo: "hecha" }) =>
    request(entorno.app.getHttpServer())
      .put(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(entorno.como("cliente"))
      .send({ dietaId, eleccion })

  it("una pauta sin registro de comidas rechaza marcar y no crea filas", async () => {
    dietaId = (await publicarDocumento({ ...documento(), registroComidas: false })).id
    try {
      expect(ErrorDeApiSchema.parse((await marcar().expect(409)).body).codigo).toBe(
        "operacion_incompatible",
      )
      expect(
        await entorno.prisma.comidaRegistrada.count({ where: { clienteId: entorno.ids.cliente } }),
      ).toBe(0)
    } finally {
      dietaId = (await publicarDocumento(documento())).id
    }
  })

  it("un plato necesita todas las columnas y no sustituye el registro previo con una selección parcial", async () => {
    const completa = {
      tipo: "plato",
      elegidos: [
        { columna: "Hidrato", alimento: "Arroz blanco" },
        { columna: "Proteína", alimento: "Pollo" },
      ],
    }
    const previa = ComidaRegistradaSchema.parse((await marcar(completa).expect(200)).body)
    expect(
      ErrorDeApiSchema.parse(
        (await marcar({ tipo: "plato", elegidos: [completa.elegidos[0]] }).expect(400)).body,
      ).codigo,
    ).toBe("solicitud_invalida")
    const fila = await entorno.prisma.comidaRegistrada.findUniqueOrThrow({
      where: {
        clienteId_fecha_comidaId: {
          clienteId: entorno.ids.cliente,
          fecha: new Date(`${hoy()}T00:00:00Z`),
          comidaId: COMIDA,
        },
      },
    })
    expect(fila.eleccion).toEqual(previa.eleccion)
    await request(entorno.app.getHttpServer())
      .delete(ruta(`comidas/${hoy()}/${COMIDA}`))
      .set(entorno.como("cliente"))
      .expect(204)
  })

  it("una retirada posterior al guard impide registrar la comida", async () => {
    const { app, prisma, ids, como } = entorno
    const servicio = app.get(ConsentimientoService)
    const original = servicio.exigirVigente.bind(servicio)
    let avisar!: () => void
    let continuar!: () => void
    const dentro = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const pausa = new Promise<void>((resolve) => {
      continuar = resolve
    })
    const espia = jest.spyOn(servicio, "exigirVigente").mockImplementationOnce(async (...args) => {
      avisar()
      await pausa
      return original(...args)
    })
    const pendiente = marcar().then((r) => r)
    try {
      await esperarPausa(dentro, pendiente)
      await request(app.getHttpServer()).delete("/consentimiento").set(como("cliente")).expect(200)
      continuar()
      const respuesta = await pendiente
      expect(respuesta.status).toBe(409)
      expect(ErrorDeApiSchema.parse(respuesta.body).codigo).toBe("consentimiento_pendiente")
      expect(await prisma.comidaRegistrada.count({ where: { clienteId: ids.cliente } })).toBe(0)
    } finally {
      continuar()
      await Promise.allSettled([pendiente])
      espia.mockRestore()
      await request(app.getHttpServer())
        .post("/consentimiento")
        .set(como("cliente"))
        .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
        .expect(201)
    }
  })

  it("si la publicación obtiene primero el bloqueo, la comida espera y rechaza la dieta archivada", async () => {
    const borrador = await crearBorrador({ ...documento(), nombre: "Pauta nueva sintética" })
    const { app, prisma, ids } = entorno
    const dietas = app.get(DietasService) as unknown as {
      cliente(
        tx: Prisma.TransactionClient,
        clienteId: string,
        bloquear: boolean,
      ): Promise<{ estado: string }>
    }
    const original = dietas.cliente.bind(dietas)
    let avisar!: () => void
    let continuar!: () => void
    let comidaIniciada!: () => void
    const dentro = new Promise<void>((resolve) => {
      avisar = resolve
    })
    const pausa = new Promise<void>((resolve) => {
      continuar = resolve
    })
    const registrando = new Promise<void>((resolve) => {
      comidaIniciada = resolve
    })
    const espia = jest.spyOn(dietas, "cliente").mockImplementationOnce(async (...args) => {
      const fila = await original(...args)
      avisar()
      await pausa
      return fila
    })
    const comidas = app.get(ComidasService)
    const registrar = comidas.registrar.bind(comidas)
    const espiaComida = jest.spyOn(comidas, "registrar").mockImplementationOnce(async (...args) => {
      comidaIniciada()
      return registrar(...args)
    })
    const publicacion = publicar(borrador.revision).then((r) => r)
    let comida: Promise<request.Response> | undefined
    try {
      await esperarPausa(dentro, publicacion)
      comida = marcar().then((r) => r)
      await esperarPausa(registrando, comida)
      continuar()
      const [publicada, registrada] = await Promise.all([publicacion, comida])
      expect(publicada.status).toBe(200)
      dietaId = DietaPublicadaSchema.parse(publicada.body).id
      expect(registrada.status).toBe(409)
      expect(ErrorDeApiSchema.parse(registrada.body).codigo).toBe("revision_obsoleta")
      expect(await prisma.comidaRegistrada.count({ where: { clienteId: ids.cliente } })).toBe(0)
      await marcar().expect(200)
    } finally {
      continuar()
      await Promise.allSettled([publicacion, comida])
      espia.mockRestore()
      espiaComida.mockRestore()
    }
  })
})
