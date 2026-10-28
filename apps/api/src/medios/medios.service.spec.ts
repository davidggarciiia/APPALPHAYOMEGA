import type { MedioFoto, SolicitudFotos } from "@prisma/client"
import type { PrismaService } from "../prisma/prisma.service.js"
import type { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { ConsentimientoService } from "../identity/consentimiento.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { SolicitudesFotosService } from "../seguimiento/solicitudes-fotos.service.js"
import type { AlmacenObjetos } from "./almacen-objetos.js"
import { LimpiezaMedios } from "./limpieza-medios.js"
import { MediosService } from "./medios.service.js"
import { jpegSintetico } from "../../test/imagenes-ayuda.js"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const cliente: IdentidadVerificada = { sub: id(1), rol: "cliente", sid: id(2) }
const autor = { id: cliente.sub, nombre: "Cliente", apellidos: null }
const jpeg = jpegSintetico()
function puerta() {
  let abrir!: () => void
  const espera = new Promise<void>((resolve) => {
    abrir = resolve
  })
  return { abrir, espera }
}

function entorno() {
  const fotos = new Map<string, MedioFoto>()
  const objetos = new Map<string, Uint8Array>()
  const intentos = new Map<
    string,
    { clave: string; medioId: string; descartadoEn: Date | null; reintentarEn: Date }
  >()
  const solicitud: SolicitudFotos = {
    id: id(3),
    clienteId: cliente.sub,
    autorId: id(4),
    operacionId: id(5),
    vistas: ["frente", "espalda"],
    fechaLimite: null,
    mensaje: null,
    estado: "pendiente",
    creadaEn: new Date(),
    recibidaEn: null,
    revisadaEn: null,
    revisionOperacionId: null,
  }
  function coincide(fila: object, where: Record<string, unknown>): boolean {
    const datos = fila as Record<string, unknown>
    return Object.entries(where).every(([clave, valor]) => {
      if (clave === "autorId_operacionId") return coincide(fila, valor as Record<string, unknown>)
      if (typeof valor === "object" && valor !== null && !(valor instanceof Date)) {
        return Object.entries(valor).every(([op, limite]) => {
          const actual = datos[clave] as number
          if (op === "not") return actual !== limite
          if (op === "lt") return actual < (limite as number)
          if (op === "lte") return actual <= (limite as number)
          if (op === "gt") return actual > (limite as number)
          if (op === "gte") return actual >= (limite as number)
          return false
        })
      }
      return datos[clave] === valor
    })
  }
  const fotoConAutor = (fila: MedioFoto) => ({ ...fila, autor })
  const solicitudConMedios = () => ({
    ...solicitud,
    autor: { ...autor, id: solicitud.autorId },
    medios: [...fotos.values()]
      .filter((f) => f.solicitudId === solicitud.id && f.estado !== "pendiente")
      .map(fotoConAutor),
  })
  const prisma = {
    medioFoto: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        const fila = [...fotos.values()].find((f) => coincide(f, where))
        return fila ? fotoConAutor(fila) : null
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        [...fotos.values()].filter((f) => coincide(f, where)).map(fotoConAutor),
      create: async ({ data }: { data: Partial<MedioFoto> & Pick<MedioFoto, "id"> }) => {
        const fila = {
          estado: "pendiente",
          creadoEn: new Date(),
          confirmadoEn: null,
          eliminadoEn: null,
          publicadaEn: null,
          ...data,
        } as MedioFoto
        fotos.set(fila.id, fila)
        return fotoConAutor(fila)
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Partial<MedioFoto>
      }) => {
        const filas = [...fotos.values()].filter((f) => coincide(f, where))
        filas.forEach((f) => Object.assign(f, data))
        return { count: filas.length }
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const filas = [...fotos.values()].filter((f) => coincide(f, where))
        filas.forEach((f) => fotos.delete(f.id))
        return { count: filas.length }
      },
    },
    solicitudFotos: {
      findFirst: async () => solicitudConMedios(),
      findUniqueOrThrow: async () => solicitudConMedios(),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Partial<SolicitudFotos>
      }) => {
        if (!coincide(solicitud, where)) return { count: 0 }
        Object.assign(solicitud, data)
        return { count: 1 }
      },
    },
    intentoFoto: {
      create: async ({
        data,
      }: {
        data: { clave: string; medioId: string; reintentarEn: Date; descartadoEn?: Date }
      }) => {
        const fila = { descartadoEn: null, ...data }
        intentos.set(data.clave, fila)
        return fila
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        [...intentos.values()].filter((f) => coincide(f, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
        const filas = [...intentos.values()].filter((f) => coincide(f, where))
        filas.forEach((f) => Object.assign(f, data))
        return { count: filas.length }
      },
      delete: async ({ where }: { where: { clave: string } }) => intentos.delete(where.clave),
    },
    $transaction: (trabajo: (tx: unknown) => Promise<unknown>) => trabajo(prisma),
  }
  const almacen: AlmacenObjetos = {
    leer: async (clave) => objetos.get(clave) ?? null,
    reemplazar: async (clave, datos) => {
      objetos.set(clave, datos)
    },
    borrar: async (clave) => {
      objetos.delete(clave)
    },
    enlaceDeLectura: async () => {
      throw new Error("Sin lectura externa en esta prueba")
    },
    enlaceDeSubida: async (clave, tipoMime, _bytes, caducaEn) => ({
      url: `https://example.test/${clave}`,
      metodo: "PUT",
      cabeceras: { "Content-Type": tipoMime },
      caducaEn: caducaEn.toISOString(),
    }),
  }
  const medios = new MediosService(
    prisma as unknown as PrismaService,
    { puedeAcceder: async () => true } as unknown as AlcanceClienteService,
    { exigirVigente: async () => undefined } as unknown as ConsentimientoService,
    almacen,
  )
  const solicitudes = new SolicitudesFotosService(prisma as unknown as PrismaService)
  const limpieza = new LimpiezaMedios(prisma as unknown as PrismaService, almacen)
  const datos = (operacionId = id(6), vista: "frente" | "espalda" = "frente") => ({
    operacionId,
    clienteId: cliente.sub,
    destino: { tipo: "solicitud" as const, solicitudId: solicitud.id },
    vista,
    etiqueta: null,
    fechaToma: "2026-09-24",
    tipoMime: "image/jpeg" as const,
    bytes: jpeg.length,
  })
  return { fotos, objetos, intentos, solicitud, medios, solicitudes, limpieza, almacen, datos }
}

describe("medios: renovación, revisión y archivos dañados", () => {
  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9])],
    [
      "image/webp",
      Buffer.concat([
        Buffer.from("RIFF"),
        Buffer.from([12, 0, 0, 0]),
        Buffer.from("WEBPVP8 "),
        Buffer.alloc(4),
      ]),
    ],
  ] as const)(
    "no confirma un %s sin píxeles aunque su contenedor sea reconocible",
    async (tipoMime, contenido) => {
      const e = entorno()
      const intencion = await e.medios.solicitarSubida(cliente, {
        ...e.datos(),
        tipoMime,
        bytes: contenido.length,
      })
      const fila = e.fotos.get(intencion.medio.id)!
      e.objetos.set(fila.clave, contenido)
      await expect(e.medios.confirmar(cliente, fila.id)).rejects.toMatchObject({ status: 400 })
      expect(e.fotos.get(fila.id)?.estado).toBe("pendiente")
      expect(e.objetos.has(fila.clave)).toBe(false)
      expect(e.intentos.size).toBe(0)
    },
  )

  it("una limpieza lenta no elimina la subida del reintento", async () => {
    const e = entorno()
    const primera = await e.medios.solicitarSubida(cliente, e.datos())
    const vieja = e.fotos.get(primera.medio.id)!
    vieja.subidaCaducaEn = new Date(Date.now() - 2 * 60 * 60_000)
    const borrando = puerta(),
      continuar = puerta()
    e.almacen.borrar = async (clave) => {
      if (clave === vieja.clave) {
        borrando.abrir()
        await continuar.espera
      }
      e.objetos.delete(clave)
    }
    const limpieza = e.limpieza.limpiar()
    await borrando.espera
    const renovada = await e.medios.solicitarSubida(cliente, e.datos())
    const actual = e.fotos.get(renovada.medio.id)!
    e.objetos.set(actual.clave, jpeg)
    continuar.abrir()
    await limpieza
    expect(e.objetos.get(actual.clave)).toEqual(jpeg)
    expect((await e.medios.confirmar(cliente, actual.id)).estado).toBe("disponible")
  })

  it("recupera un borrado externo fallido con una intención durable de limpieza", async () => {
    const e = entorno()
    const primera = await e.medios.solicitarSubida(cliente, e.datos())
    const vieja = e.fotos.get(primera.medio.id)!
    vieja.subidaCaducaEn = new Date(Date.now() - 2 * 60 * 60_000)
    e.objetos.set(vieja.clave, jpeg)
    let fallar = true
    e.almacen.borrar = async (clave) => {
      if (fallar) {
        fallar = false
        throw new Error("Fallo sintético")
      }
      e.objetos.delete(clave)
    }
    await e.limpieza.limpiar()
    expect(e.intentos.get(vieja.clave)).toMatchObject({ descartadoEn: expect.any(Date) })
    await e.limpieza.limpiar()
    expect(e.objetos.has(vieja.clave)).toBe(false)
  })

  it("una foto recibida tras la revisión vuelve a dejar la solicitud sin revisar", async () => {
    const e = entorno()
    const primera = await e.medios.solicitarSubida(cliente, e.datos())
    const segunda = await e.medios.solicitarSubida(cliente, e.datos(id(7), "espalda"))
    e.objetos.set(e.fotos.get(primera.medio.id)!.clave, jpeg)
    await e.medios.confirmar(cliente, primera.medio.id)
    expect((await e.solicitudes.revisar(cliente.sub, e.solicitud.id, id(8))).estado).toBe(
      "revisada",
    )
    e.objetos.set(e.fotos.get(segunda.medio.id)!.clave, jpeg)
    await e.medios.confirmar(cliente, segunda.medio.id)
    expect(e.solicitud).toMatchObject({ estado: "recibida", revisadaEn: null })
    // Una repetición de la revisión antigua no da por vista la foto nueva.
    expect((await e.solicitudes.revisar(cliente.sub, e.solicitud.id, id(8))).estado).toBe(
      "recibida",
    )
    expect((await e.solicitudes.revisar(cliente.sub, e.solicitud.id, id(9))).medios).toHaveLength(2)
  })

  it("no publica un PNG con IHDR vacío y sin IDAT", async () => {
    const e = entorno()
    const png = Uint8Array.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0, 73, 72, 68, 82, 168, 161, 174, 10, 0, 0, 0, 0,
      73, 69, 78, 68, 174, 66, 96, 130,
    ])
    const primera = await e.medios.solicitarSubida(cliente, {
      ...e.datos(),
      tipoMime: "image/png",
      bytes: png.length,
    })
    const fila = e.fotos.get(primera.medio.id)!
    e.objetos.set(fila.clave, png)
    const respuesta = await e.medios.confirmar(cliente, fila.id).then(
      () => 200,
      (error: { getStatus(): number }) => error.getStatus(),
    )
    expect(respuesta).toBe(400)
    expect(fila.estado).toBe("pendiente")
    expect(e.intentos.size).toBe(0)
  })
})
