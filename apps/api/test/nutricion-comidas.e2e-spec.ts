import { randomUUID } from "node:crypto"
import request from "supertest"
import {
  BorradorDietaSchema,
  ComidaRegistradaSchema,
  DietaPublicadaSchema,
  LecturaDietaVigenteSchema,
  ListadoComidasRegistradasSchema,
  ZONA_AGENDA,
  type DocumentoDieta,
} from "@alpha-omega/shared"
import { entornoNutricion } from "./nutricion-ayuda.js"

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
