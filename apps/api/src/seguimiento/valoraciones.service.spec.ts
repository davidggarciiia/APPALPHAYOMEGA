import {
  DocumentoValoracionSchema,
  VERSION_CONSENTIMIENTO,
  type DocumentoValoracion,
} from "@alpha-omega/shared"
import type { PrismaService } from "../prisma/prisma.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import type { PlantillasValoracionService } from "./plantillas-valoracion.service.js"
import { ValoracionesService } from "./valoraciones.service.js"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const clienteId = id(1),
  visitaId = id(2),
  borradorId = id(3),
  ahora = new Date("2026-09-24T10:00:00Z")
const actor = { sub: id(4), rol: "entrenador" as const, sid: id(5) }
const peso = {
  id: id(6),
  version: 1,
  bloque: "medidas" as const,
  magnitud: "peso" as const,
  nombre: "Peso",
  unidad: "kg" as const,
  zona: null,
  lateralidad: null,
  instrumento: null,
  protocolo: null,
  activa: true,
}
const vacio = {
  definiciones: { corporales: [], pruebas: [] },
  bloques: ["medidas" as const],
  corporales: [],
  pruebas: [],
  grasaPorPliegues: null,
  destacados: [],
  conclusion: null,
  notasInternas: null,
}
const publicable = DocumentoValoracionSchema.parse({ ...vacio, conclusion: "Conclusión" })
const peticion = { operacionId: id(7), borradorId, revision: 1, sustituyePublicacionId: null }
function entorno(documento: DocumentoValoracion) {
  const visita = { id: visitaId, clienteId, tipo: "inicial", anteriorId: null, creadaEn: ahora }
  const estado = {
    borrador: {
      id: borradorId,
      revision: 1,
      valoracionAbiertaId: visitaId as string | null,
      fechaToma: ahora,
      corrigePublicacionId: null as string | null,
      documento,
      creadoEn: ahora,
      actualizadoEn: ahora,
    },
    publicacion: null as Record<string, unknown> | null,
    operacion: null as Record<string, unknown> | null,
    visitasCreadas: 0,
  }
  const consentimiento = {
    version: VERSION_CONSENTIMIENTO,
    aceptadoEn: ahora,
    retiradoEn: null as Date | null,
  }
  let foto = {
    id: id(9),
    clienteId,
    autorId: clienteId,
    autor: { id: clienteId, nombre: "Cliente", apellidos: null },
    origen: "cliente",
    vista: "frente",
    etiqueta: null,
    fechaToma: ahora,
    estado: "disponible",
    tipoMime: "image/jpeg",
    bytes: 100,
    valoracionId: null as string | null,
    solicitudId: id(10),
    creadoEn: ahora,
    confirmadoEn: ahora,
    publicadaEn: null as Date | null,
  }
  let alLeerFoto: (() => Promise<void>) | undefined
  const tx = {
    usuario: { findFirst: async () => ({ estado: "activo" }) },
    consentimientoSalud: {
      findUnique: async () => consentimiento,
      findFirst: async () => consentimiento,
      updateMany: async ({ data }: { data: { retiradoEn: Date } }) => {
        Object.assign(consentimiento, data)
        return { count: 1 }
      },
    },
    valoracion: {
      create: async () => {
        estado.visitasCreadas += 1
        return visita
      },
      findFirst: async () => ({
        ...visita,
        borradores: estado.borrador.valoracionAbiertaId ? [{ ...estado.borrador }] : [],
        publicaciones: estado.publicacion ? [estado.publicacion] : [],
      }),
    },
    borradorValoracion: {
      findUnique: async () => (estado.borrador.valoracionAbiertaId ? estado.borrador : null),
      create: async ({
        data,
      }: {
        data: {
          revision?: number
          fechaToma: Date
          documento: DocumentoValoracion
          valoracionAbiertaId: string
          corrigePublicacionId?: string
        }
      }) => {
        estado.borrador = {
          ...estado.borrador,
          ...data,
          revision: data.revision ?? 1,
          corrigePublicacionId: data.corrigePublicacionId ?? null,
        }
        return estado.borrador
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { revision: number; valoracionAbiertaId: string }
        data: {
          revision?: { increment: number }
          documento?: DocumentoValoracion
          valoracionAbiertaId?: null
        }
      }) => {
        if (
          estado.borrador.revision !== where.revision ||
          estado.borrador.valoracionAbiertaId !== where.valoracionAbiertaId
        )
          return { count: 0 }
        estado.borrador = {
          ...estado.borrador,
          ...data,
          revision: estado.borrador.revision + (data.revision?.increment ?? 0),
        }
        return { count: 1 }
      },
    },
    operacionValoracion: {
      findUnique: async ({ where }: { where: { autorId_operacionId: { operacionId: string } } }) =>
        estado.operacion?.operacionId === where.autorId_operacionId.operacionId
          ? estado.operacion
          : null,
      create: async ({ data }: { data: Record<string, unknown> }) => (estado.operacion = data),
    },
    publicacionValoracion: {
      create: async ({ data }: { data: Record<string, unknown> }) =>
        (estado.publicacion = {
          ...data,
          id: id(8),
          publicadaEn: ahora,
          valoracion: visita,
          autor: { id: actor.sub, nombre: "Entrenador", apellidos: null },
          sustituidaPor: null,
          borrador: { ...estado.borrador },
        }),
      findFirst: async () => estado.publicacion,
      findUniqueOrThrow: async () => estado.publicacion,
    },
    medioFoto: {
      findFirst: async () => {
        const copia = { ...foto }
        await alLeerFoto?.()
        return copia
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { valoracionId: string | null }
        data: { valoracionId?: string; publicadaEn?: Date }
      }) => {
        if (foto.valoracionId !== where.valoracionId) return { count: 0 }
        foto = { ...foto, ...data }
        return { count: 1 }
      },
      findUniqueOrThrow: async () => foto,
    },
  }
  let candado = Promise.resolve()
  const repositorio = {
    ...tx,
    $transaction: async <T>(f: (t: unknown) => Promise<T>) => {
      let soltar: (() => void) | undefined
      const cliente = {
        ...tx,
        $queryRaw: async (consulta: TemplateStringsArray) => {
          if (consulta.join("").includes("consentimientos_salud"))
            return [{ retiradoEn: consentimiento.retiradoEn }]
          const anterior = candado
          candado = new Promise<void>((r) => (soltar = r))
          await anterior
          return [{ id: visitaId }]
        },
      }
      try {
        return await f(cliente)
      } finally {
        soltar?.()
      }
    },
  }
  const plantilla = { leer: async () => ({ revision: 1, ...documento.definiciones }) }
  const consentimientoService = new ConsentimientoService(repositorio as unknown as PrismaService)
  return {
    estado,
    foto: () => foto,
    pausarLecturaFoto: (pausa: () => Promise<void>) => (alLeerFoto = pausa),
    consentimiento: consentimientoService,
    servicio: new ValoracionesService(
      repositorio as unknown as PrismaService,
      plantilla as unknown as PlantillasValoracionService,
      consentimientoService,
    ),
  }
}
describe("ValoracionesService: conservar resultados y publicaciones", () => {
  it.each(["crear", "corregir", "cambiar", "publicar", "vincular"] as const)(
    "rechaza %s después de una retirada sin persistir datos de salud",
    async (operacion) => {
      const e = entorno(publicable)
      if (operacion === "corregir") await e.servicio.publicar(actor, clienteId, visitaId, peticion)
      const anterior = structuredClone(e.estado)
      const fotoAnterior = structuredClone(e.foto())
      expect(await e.consentimiento.vigente(clienteId)).toBe(true)
      await e.consentimiento.retirar(clienteId)
      expect(await e.consentimiento.vigente(clienteId)).toBe(false)
      const ejecutar = {
        crear: () =>
          e.servicio.crear(actor, clienteId, {
            operacionId: id(20),
            tipo: "inicial",
            fechaToma: "2026-09-24",
            bloques: ["medidas"],
          }),
        corregir: () =>
          e.servicio.crear(actor, clienteId, {
            operacionId: id(20),
            corrigePublicacionId: id(8),
          }),
        cambiar: () =>
          e.servicio.cambiar(clienteId, visitaId, {
            borradorId,
            revision: 1,
            fechaToma: "2026-09-24",
            contenido: { ...vacio, conclusion: "Guardada después de la retirada" },
          }),
        publicar: () => e.servicio.publicar(actor, clienteId, visitaId, peticion),
        vincular: () => e.servicio.vincularFoto(clienteId, visitaId, id(9)),
      }
      await expect(ejecutar[operacion]()).rejects.toMatchObject({
        response: { codigo: "consentimiento_pendiente" },
      })
      expect(e.estado).toEqual(anterior)
      expect(e.foto()).toEqual(fotoAnterior)
    },
  )
  it("rechaza una definición desconocida sin borrar el resultado previo", async () => {
    const documento = DocumentoValoracionSchema.parse({
      ...vacio,
      definiciones: { corporales: [peso], pruebas: [] },
      corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80 }],
    })
    const e = entorno(documento)
    await expect(
      e.servicio.cambiar(clienteId, visitaId, {
        borradorId,
        revision: 1,
        fechaToma: "2026-09-24",
        contenido: {
          bloques: documento.bloques,
          corporales: [{ definicionId: id(99), estado: "registrado", valor: 90 }],
          pruebas: [],
          grasaPorPliegues: null,
          destacados: [],
          conclusion: null,
          notasInternas: null,
        },
      }),
    ).rejects.toMatchObject({ response: { codigo: "solicitud_invalida" } })
    expect(e.estado.borrador.documento).toEqual(documento)
    expect(e.estado.borrador.revision).toBe(1)
  })
  it("publica un porcentaje de grasa por pliegues como único resultado", async () => {
    const documento = DocumentoValoracionSchema.parse({
      ...vacio,
      bloques: ["pliegues"],
      grasaPorPliegues: { valorPct: 18.5, metodo: "Método del profesional", fecha: "2026-09-24" },
    })
    await expect(
      entorno(documento).servicio.publicar(actor, clienteId, visitaId, peticion),
    ).resolves.toMatchObject({ documento: { grasaPorPliegues: documento.grasaPorPliegues } })
  })
  it("devuelve la misma publicación a dos solicitudes simultáneas con el mismo UUID", async () => {
    const e = entorno(publicable)
    const respuestas = await Promise.all([
      e.servicio.publicar(actor, clienteId, visitaId, peticion),
      e.servicio.publicar(actor, clienteId, visitaId, peticion),
    ])
    expect(respuestas[0]).toEqual(respuestas[1])
  })
  it("coordina vincular con publicar: todo vínculo aceptado queda incluido en la publicación", async () => {
    const e = entorno({ ...publicable, bloques: ["medidas", "fotos"] })
    let leyendo!: () => void, continuar!: () => void
    const leida = new Promise<void>((r) => (leyendo = r)),
      pausa = new Promise<void>((r) => (continuar = r))
    e.pausarLecturaFoto(async () => {
      leyendo()
      await pausa
    })
    const vincular = e.servicio.vincularFoto(clienteId, visitaId, id(9))
    await leida
    const ambas = Promise.allSettled([
      vincular,
      e.servicio.publicar(actor, clienteId, visitaId, peticion),
    ])
    await new Promise<void>((r) => setImmediate(r))
    continuar()
    const respuestas = await ambas
    expect(respuestas[1].status).toBe("fulfilled")
    if (respuestas[0].status === "fulfilled") expect(e.foto().publicadaEn).not.toBeNull()
    else expect(respuestas[0].reason).toMatchObject({ status: 409 })
  })
})
