import { randomUUID } from "node:crypto"
import { jest } from "@jest/globals"
import request from "supertest"
import {
  IntencionSubidaSchema,
  PlanAsignadoSchema,
  VERSION_CONSENTIMIENTO,
  type GuardarBorrador,
} from "@alpha-omega/shared"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"
import { jpegSintetico, rutaDeEnlace } from "./imagenes-ayuda.js"
import { SesionesService } from "../src/entrenamiento/sesiones.service.js"
import { ALMACEN_OBJETOS, type AlmacenObjetos } from "../src/medios/almacen-objetos.js"

/** Cada caso empieza con consentimiento y prepara únicamente sus propios datos sintéticos. */
describe("Retirada del consentimiento con operaciones pendientes", () => {
  let entorno: Awaited<ReturnType<typeof entornoEntrenamiento>>
  const http = () => entorno.app.getHttpServer()
  const cliente = () => entorno.ids.cliente!
  const retirar = () =>
    request(http()).delete("/consentimiento").set(entorno.como("cliente")).expect(200)

  beforeAll(async () => {
    entorno = await entornoEntrenamiento("consentimiento-pendientes")
  })
  beforeEach(async () => {
    await request(http())
      .post("/consentimiento")
      .set(entorno.como("cliente"))
      .send({ version: VERSION_CONSENTIMIENTO, acepto: true })
      .expect(201)
  })
  afterAll(async () => {
    await entorno?.cerrar()
  })

  it.each(["anterior", "simultanea"] as const)(
    "impide confirmar una foto con retirada %s",
    async (momento) => {
      const imagen = jpegSintetico()
      const valoracion = await entorno.prisma.valoracion.create({
        data: { clienteId: cliente(), autorId: entorno.ids.entrenador!, tipo: "inicial" },
      })
      const { medio, subida } = IntencionSubidaSchema.parse(
        (
          await request(http())
            .post("/medios/subidas")
            .set(entorno.como("entrenador"))
            .send({
              operacionId: randomUUID(),
              clienteId: cliente(),
              destino: { tipo: "valoracion", valoracionId: valoracion.id },
              vista: "frente",
              etiqueta: null,
              fechaToma: "2026-09-24",
              tipoMime: "image/jpeg",
              bytes: imagen.length,
            })
            .expect(201)
        ).body,
      )
      await request(http())
        .put(rutaDeEnlace(subida!.url))
        .set("Content-Type", "image/jpeg")
        .send(imagen)
        .expect(204)
      if (momento === "anterior") await retirar()
      const almacen = entorno.app.get<AlmacenObjetos>(ALMACEN_OBJETOS)
      const leer = almacen.leer.bind(almacen)
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
          ? jest.spyOn(almacen, "leer").mockImplementationOnce(async (clave) => {
              const contenido = await leer(clave)
              avisar()
              await pausa
              return contenido
            })
          : null
      const pendiente = request(http())
        .post(`/medios/${medio.id}/confirmacion`)
        .set(entorno.como("entrenador"))
        .on("response", avisar)
        .then((respuesta) => respuesta)
      try {
        if (momento === "simultanea") {
          await dentro
          await retirar()
          liberar()
        }
        const respuesta = await pendiente
        expect(respuesta.status).toBe(409)
        expect(respuesta.body.codigo).toBe("consentimiento_pendiente")
        expect(
          await entorno.prisma.medioFoto.findUniqueOrThrow({ where: { id: medio.id } }),
        ).toMatchObject({ estado: "pendiente" })
      } finally {
        liberar()
        await pendiente
        espia?.mockRestore()
      }
    },
  )

  it.each([
    ["borrador", "anterior"],
    ["enviar", "anterior"],
    ["borrador", "simultanea"],
    ["enviar", "simultanea"],
  ] as const)(
    "impide %s con retirada %s y un nuevo chequeo del cliente",
    async (accion, momento) => {
      const plan = entorno.plan()
      const asignado = PlanAsignadoSchema.parse(
        (
          await request(http())
            .post(`/entrenamiento/clientes/${cliente()}/planes`)
            .set(entorno.como("entrenador"))
            .send(plan)
            .expect(201)
        ).body,
      )
      const id = asignado.sesiones[0]!.agenda.id
      const datos: GuardarBorrador = {
        operacionId: randomUUID(),
        revisionPrescripcion: 0,
        revisionBorrador: 0,
        registro: {
          notas: null,
          checkin: { sensacion: 2, molestia: "dolor" },
          series: [
            {
              serieId: plan.patron.sesiones[0]!.ejercicios[0]!.series[0]!.id,
              tipoMedicion: "repeticiones",
              pesoKg: 20,
              repeticiones: 10,
              hecha: true,
            },
          ],
        },
      }
      if (momento === "anterior") await retirar()
      const sesiones = entorno.app.get(SesionesService)
      const bloquear = sesiones.bloquear.bind(sesiones)
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
          ? jest.spyOn(sesiones, "bloquear").mockImplementationOnce(async (...argumentos) => {
              const fila = await bloquear(...argumentos)
              avisar()
              await pausa
              return fila
            })
          : null

      const ruta = `/entrenamiento/sesiones/${id}/${accion}`
      const peticion = request(http())
      const pendiente = (accion === "borrador" ? peticion.put(ruta) : peticion.post(ruta))
        .set(entorno.como("cliente"))
        .send(datos)
        .on("response", avisar)
        .then((respuesta) => respuesta)
      try {
        if (momento === "simultanea") {
          await dentro
          await retirar()
          liberar()
        }
        const respuesta = await pendiente
        expect(respuesta.status).toBe(409)
        expect(respuesta.body.codigo).toBe("consentimiento_pendiente")
        const fila = await entorno.prisma.sesionEntrenamiento.findUniqueOrThrow({ where: { id } })
        expect(fila.borrador).toBeNull()
        expect(fila.resultado).toBeNull()
      } finally {
        liberar()
        await pendiente
        espia?.mockRestore()
      }
    },
  )
})
