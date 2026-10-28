import {
  PrescripcionSchema,
  ResultadoEntrenamientoSchema,
  VERSION_CONSENTIMIENTO,
  type RegistrarMolestia,
} from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import { SeguimientoService } from "./seguimiento.service.js"
import { SesionesService } from "../entrenamiento/sesiones.service.js"
import { MolestiasService } from "../entrenamiento/molestias.service.js"
import { ComentariosService } from "../entrenamiento/comentarios.service.js"
import { ComidasService } from "../nutricion/comidas.service.js"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const clienteId = id(1),
  sesionId = id(2),
  operacionId = id(3)
const actor = { sub: clienteId, rol: "cliente" as const, sid: id(4) }
const entrenador = { ...actor, sub: id(5), rol: "entrenador" as const }
const prescripcion = PrescripcionSchema.parse({
  nombre: "Banca",
  ejercicios: [
    {
      id: id(6),
      ejercicioId: id(7),
      nombre: "Banca",
      indicaciones: null,
      series: [{ id: id(8), tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 5 }],
    },
  ],
})
const resultado = ResultadoEntrenamientoSchema.parse({
  sesionId,
  prescripcion,
  revisionPrescripcion: 0,
  enviadoEn: "2026-09-24T10:00:00Z",
  notas: null,
  series: [
    {
      serieId: id(8),
      hecha: true,
      valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 5 },
    },
  ],
})
const molestia: RegistrarMolestia = {
  operacionId,
  ejercicioPrescritoId: null,
  serie: null,
  zona: "hombro",
  intensidad: 4,
  sintomas: [],
  nota: null,
}
const medida = {
  operacionId,
  fecha: "2026-09-24",
  pesoKg: 80,
  alturaCm: null,
  cinturaCm: null,
  grasaPct: null,
}
const prueba = { operacionId, fecha: "2026-09-24", nombre: "Salto", unidad: "m", valor: 1.234 }

function entorno() {
  let retiradoEn: Date | null = null,
    escrituras = 0
  const crearModelo = (transformar: (data: Record<string, unknown>) => Record<string, unknown>) => {
    let fila: Record<string, unknown> | null = null
    return {
      findUnique: async () => fila,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (fila) throw { code: "P2002" }
        escrituras++
        fila = transformar(data)
        return fila
      },
    }
  }
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) =>
      sql.join("?").includes('"consentimientos_salud"')
        ? [{ retiradoEn }]
        : [{ id: clienteId, rol: "cliente", estado: "activo" }],
    usuario: { findFirst: async () => ({ estado: "activo", fechaNacimiento: null }) },
    diaSeguimiento: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        escrituras++
        return {
          pesoKg: null,
          pasos: null,
          suenoMin: null,
          creatina: null,
          suplementos: [],
          ...create,
        }
      },
    },
    consentimientoSalud: {
      findUnique: async () => ({ retiradoEn }),
      findFirst: async () => ({
        version: VERSION_CONSENTIMIENTO,
        retiradoEn,
        aceptadoEn: new Date("2026-09-24"),
      }),
      updateMany: async () => {
        retiradoEn = new Date()
        return { count: 1 }
      },
    },
    medidaCorporal: crearModelo((data) => ({
      ...data,
      id: id(10),
      creadoEn: new Date("2026-09-24"),
    })),
    pruebaFisica: crearModelo((data) => ({
      ...data,
      valor: Number(Number(data.valor).toFixed(2)),
      id: id(11),
      creadoEn: new Date("2026-09-24"),
    })),
    molestia: crearModelo((data) => ({
      ...data,
      id: id(12),
      creadaEn: new Date("2026-09-24"),
      estado: "abierta",
      respuesta: null,
      atendidaEn: null,
    })),
    comentarioSesion: crearModelo((data) => ({
      ...data,
      id: id(13),
      creadoEn: new Date("2026-09-24"),
      autor: { id: actor.sub, nombre: "Cliente", rol: actor.rol },
    })),
    novedadEntrenamiento: { create: async () => ({}) },
    sesionEntrenamiento: {
      findUnique: async () => ({ clienteId, version: 1, prescripcion, resultado }),
    },
    dieta: {
      findFirst: async () => ({
        id: id(14),
        documento: {
          formato: 1,
          nombre: "Dieta",
          indicaciones: [],
          semana: Array(7).fill(id(15)),
          tiposDeDia: [
            {
              id: id(15),
              nombre: "Todos",
              objetivo: null,
              comidas: [
                {
                  id: id(16),
                  nombre: "Comida",
                  hora: null,
                  indicacion: null,
                  forma: "intercambio",
                  columnas: [
                    { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: null }] },
                  ],
                },
              ],
            },
          ],
        },
      }),
    },
    comidaRegistrada: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        escrituras++
        return { ...create, registradaEn: new Date() }
      },
    },
  }
  const repositorio = { ...tx, $transaction: async <T>(f: (t: typeof tx) => Promise<T>) => f(tx) }
  const prisma = repositorio as unknown as PrismaService
  const consentimiento = new ConsentimientoService(prisma)
  const sesiones = new SesionesService(prisma)
  const seguimiento = Reflect.construct(SeguimientoService, [
    prisma,
    consentimiento,
  ]) as SeguimientoService
  const molestias = Reflect.construct(MolestiasService, [
    prisma,
    sesiones,
    consentimiento,
  ]) as MolestiasService
  const comidas = Reflect.construct(ComidasService, [prisma, consentimiento]) as ComidasService
  const comentarios = new ComentariosService(prisma, sesiones)
  return {
    seguimiento,
    molestias,
    comidas,
    comentarios,
    consentimiento,
    escrituras: () => escrituras,
  }
}

describe("Escrituras tras retirar el consentimiento después del guard", () => {
  const casos = [
    [
      "diario",
      (e: ReturnType<typeof entorno>) =>
        e.seguimiento.cambiarDia(clienteId, medida.fecha, { pesoKg: 80 }),
    ],
    [
      "medida",
      (e: ReturnType<typeof entorno>) =>
        e.seguimiento.registrarMedida(entrenador, clienteId, medida),
    ],
    [
      "prueba",
      (e: ReturnType<typeof entorno>) =>
        e.seguimiento.registrarPrueba(entrenador, clienteId, prueba),
    ],
    [
      "molestia",
      (e: ReturnType<typeof entorno>) => e.molestias.registrar(actor, sesionId, molestia),
    ],
    [
      "comida",
      (e: ReturnType<typeof entorno>) =>
        e.comidas.registrar(clienteId, medida.fecha, id(16), {
          dietaId: id(14),
          eleccion: { tipo: "hecha" },
        }),
    ],
  ] as const
  it.each(casos)("rechaza %s sin almacenar datos nuevos", async (_nombre, escribir) => {
    const e = entorno()
    expect(await e.consentimiento.vigente(clienteId)).toBe(true)
    await e.consentimiento.retirar(clienteId)
    await expect(escribir(e)).rejects.toMatchObject({
      response: { codigo: "consentimiento_pendiente" },
    })
    expect(e.escrituras()).toBe(0)
  })
})

describe("Operaciones de registro idempotentes", () => {
  it.each(["medida", "prueba", "molestia", "comentario"] as const)(
    "devuelve la misma %s en dos peticiones simultáneas",
    async (tipo) => {
      const e = entorno()
      const escribir = () =>
        tipo === "medida"
          ? e.seguimiento.registrarMedida(entrenador, clienteId, medida)
          : tipo === "prueba"
            ? e.seguimiento.registrarPrueba(entrenador, clienteId, { ...prueba, valor: 1.23 })
            : tipo === "molestia"
              ? e.molestias.registrar(actor, sesionId, molestia)
              : e.comentarios.comentar(actor, sesionId, {
                  operacionId,
                  ejercicioPrescritoId: null,
                  texto: "Una nota",
                })
      const respuestas = await Promise.all([escribir(), escribir()])
      expect(respuestas[0]).toEqual(respuestas[1])
      expect(e.escrituras()).toBe(1)
    },
  )
  it("normaliza dos decimales antes de guardar y comparar el reintento de una prueba", async () => {
    const e = entorno()
    const primera = await e.seguimiento.registrarPrueba(entrenador, clienteId, prueba)
    await expect(e.seguimiento.registrarPrueba(entrenador, clienteId, prueba)).resolves.toEqual(
      primera,
    )
    expect(primera.valor).toBe(1.23)
  })
  it.each(["medida", "prueba", "molestia", "comentario"] as const)(
    "rechaza el contenido distinto en una carrera de UUID de %s",
    async (tipo) => {
      const e = entorno()
      const escribir = (otra: boolean) =>
        tipo === "medida"
          ? e.seguimiento.registrarMedida(entrenador, clienteId, {
              ...medida,
              pesoKg: otra ? 81 : 80,
            })
          : tipo === "prueba"
            ? e.seguimiento.registrarPrueba(entrenador, clienteId, {
                ...prueba,
                valor: otra ? 2 : 1,
              })
            : tipo === "molestia"
              ? e.molestias.registrar(actor, sesionId, {
                  ...molestia,
                  nota: otra ? "Otra nota" : null,
                })
              : e.comentarios.comentar(actor, sesionId, {
                  operacionId,
                  ejercicioPrescritoId: null,
                  texto: otra ? "Otra nota" : "Una nota",
                })
      const respuestas = await Promise.allSettled([escribir(false), escribir(true)])
      expect(respuestas.filter((r) => r.status === "fulfilled")).toHaveLength(1)
      expect(respuestas.find((r) => r.status === "rejected")).toMatchObject({
        reason: { response: { codigo: "operacion_incompatible" } },
      })
      expect(e.escrituras()).toBe(1)
    },
  )
  it.each([
    { zona: "codo" as const },
    { nota: "Otra nota" },
    { sintomas: ["pinchazo" as const] },
    { ejercicioPrescritoId: id(6) },
    { ejercicioPrescritoId: id(6), serie: 1 },
  ])("rechaza un UUID de molestia reutilizado con otro contenido: %j", async (cambio) => {
    const e = entorno()
    await e.molestias.registrar(actor, sesionId, molestia)
    await expect(
      e.molestias.registrar(actor, sesionId, { ...molestia, ...cambio }),
    ).rejects.toMatchObject({ response: { codigo: "operacion_incompatible" } })
  })
})
