import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals"
import { Platform } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { ImageManipulator } from "expo-image-manipulator"
import { BYTES_MAXIMOS_FOTO } from "@alpha-omega/shared"

import {
  CALIDAD_JPEG,
  ErrorDeFoto,
  LADO_MAXIMO_FOTO,
  elegirFoto,
  liberarFoto,
  obtenerFoto,
  prepararFoto,
} from "./preparar-foto"

jest.mock("expo-image-picker", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))
jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: { manipulate: jest.fn() },
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
}))

/**
 * Disco sintético del móvil: qué archivos existen, cuáles no se dejan borrar y
 * qué se ha borrado. Imita `File` de expo-file-system: `delete()` lanza si el
 * archivo no existe o si el almacenamiento falla.
 */
const mockDisco = {
  cache: "",
  archivos: new Set<string>(),
  fallos: new Set<string>(),
  borrados: [] as string[],
}
jest.mock("expo-file-system", () => ({
  File: class {
    readonly uri: string
    constructor(ruta: string) {
      this.uri = ruta
    }
    get exists(): boolean {
      return mockDisco.archivos.has(this.uri)
    }
    delete(): void {
      if (mockDisco.fallos.has(this.uri)) throw new Error("EACCES sintético")
      if (!mockDisco.archivos.delete(this.uri)) throw new Error("No existe")
      mockDisco.borrados.push(this.uri)
    }
  },
  Paths: {
    get cache() {
      return { uri: mockDisco.cache }
    },
  },
}))

// Todo es sintético: rutas, dimensiones y bytes inventados; ninguna foto real.
const ORIGINAL = "file:///cache/ImagePicker/sintetica-original.jpg"
const SALIDA = "file:///cache/ImageManipulator/sintetica-preparada.jpg"

const permiso = (
  concedido: boolean,
  puedePedirOtraVez = true,
): ImagePicker.CameraPermissionResponse => ({
  granted: concedido,
  canAskAgain: puedePedirOtraVez,
  expires: "never",
  status: concedido ? ImagePicker.PermissionStatus.GRANTED : ImagePicker.PermissionStatus.DENIED,
})
const elegida = (
  asset: Partial<ImagePicker.ImagePickerAsset> = {},
): ImagePicker.ImagePickerResult => ({
  canceled: false,
  assets: [{ uri: ORIGINAL, width: 4000, height: 3000, type: "image", ...asset }],
})
const cancelada: ImagePicker.ImagePickerResult = { canceled: true, assets: null }

const camara = jest.mocked(ImagePicker.launchCameraAsync)
const galeria = jest.mocked(ImagePicker.launchImageLibraryAsync)
const permisoCamara = jest.mocked(ImagePicker.requestCameraPermissionsAsync)
const permisoFotos = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
const manipular = jest.mocked(ImageManipulator.manipulate)

type Ref = { width: number; height: number; saveAsync: jest.Mock; release: jest.Mock }

/**
 * Contexto del manipulador: la orientación ya viene aplicada al cargar (así lo
 * hace la librería en iOS, Android y web), `resize` con un solo lado conserva
 * la proporción y cada `renderAsync` entrega una referencia nueva.
 */
function manipuladorFalso(ancho: number, alto: number, fallo?: Error, salida = SALIDA) {
  let w = ancho
  let h = alto
  const referencias: Ref[] = []
  const contexto = {
    resize: jest.fn((t: { width?: number | null; height?: number | null }) => {
      if (t.width) {
        h = Math.round((h * t.width) / w)
        w = t.width
      } else if (t.height) {
        w = Math.round((w * t.height) / h)
        h = t.height
      }
      return contexto
    }),
    rotate: jest.fn(() => contexto),
    renderAsync: jest.fn(async () => {
      if (fallo) throw fallo
      const ref: Ref = {
        width: w,
        height: h,
        saveAsync: jest.fn(async () => ({ uri: salida, width: ref.width, height: ref.height })),
        release: jest.fn(),
      }
      referencias.push(ref)
      return ref
    }),
    release: jest.fn(),
  }
  manipular.mockReturnValue(contexto as unknown as ReturnType<typeof manipular>)
  return { contexto, referencias }
}

/** JPEG sintético: marca de inicio, relleno y marca de fin. */
function jpegSintetico(bytes: number): Uint8Array {
  const datos = new Uint8Array(bytes)
  datos.set([0xff, 0xd8, 0xff, 0xe0])
  datos.set([0xff, 0xd9], bytes - 2)
  return datos
}

/** Lectura del archivo preparado; `cerrar` hace de `close()` del blob nativo. */
function archivoPreparado(datos: Uint8Array, tipo = "image/jpeg") {
  const cerrar = jest.fn()
  const leer = jest.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      ({
        blob: async () =>
          Object.assign(new Blob([Uint8Array.from(datos)], { type: tipo }), { close: cerrar }),
      }) as unknown as Response,
  )
  return { leer, cerrar }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe("elegir la foto", () => {
  it("la cámara pide su permiso y, si se deniega, lo dice sin abrirla ni lanzar", async () => {
    permisoCamara.mockResolvedValue(permiso(false, false))

    const resultado = await elegirFoto("camara")

    expect(resultado).toEqual({
      tipo: "sinPermiso",
      mensaje: expect.stringContaining("ajustes") as unknown as string,
    })
    expect(camara).not.toHaveBeenCalled()
  })

  it("si el permiso se puede volver a pedir, lo ofrece y sugiere la galería", async () => {
    permisoCamara.mockResolvedValue(permiso(false, true))

    const resultado = await elegirFoto("camara")

    expect(resultado.tipo).toBe("sinPermiso")
    expect(resultado.tipo === "sinPermiso" && resultado.mensaje).toMatch(/galería/)
  })

  it("con permiso abre la cámara solo para imágenes y sin pedir EXIF", async () => {
    permisoCamara.mockResolvedValue(permiso(true))
    camara.mockResolvedValue(elegida())

    expect(await elegirFoto("camara")).toEqual({ tipo: "elegida", uri: ORIGINAL })
    expect(camara).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ["images"],
        exif: false,
        base64: false,
        allowsEditing: false,
        allowsMultipleSelection: false,
      }),
    )
  })

  it("la galería usa el selector del sistema, sin pedir acceso a toda la fototeca", async () => {
    galeria.mockResolvedValue(elegida())

    expect(await elegirFoto("galeria")).toEqual({ tipo: "elegida", uri: ORIGINAL })
    expect(permisoFotos).not.toHaveBeenCalled()
    expect(permisoCamara).not.toHaveBeenCalled()
    expect(galeria).toHaveBeenCalledWith(
      expect.objectContaining({ mediaTypes: ["images"], exif: false }),
    )
  })

  it("cancelar el selector devuelve «cancelada» sin lanzar", async () => {
    galeria.mockResolvedValue(cancelada)
    expect(await elegirFoto("galeria")).toEqual({ tipo: "cancelada" })

    // Algunos Android devuelven la lista vacía en lugar de `canceled`.
    galeria.mockResolvedValue({ canceled: false, assets: [] })
    expect(await elegirFoto("galeria")).toEqual({ tipo: "cancelada" })
  })

  it("un vídeo o un selector que falla se explica sin lanzar", async () => {
    galeria.mockResolvedValue(elegida({ type: "video" }))
    expect(await elegirFoto("galeria")).toEqual({
      tipo: "fallo",
      mensaje: "Elige una foto, no un vídeo.",
    })

    permisoCamara.mockResolvedValue(permiso(true))
    camara.mockRejectedValue(new Error("Sin aplicación de cámara"))
    expect(await elegirFoto("camara")).toEqual({
      tipo: "fallo",
      mensaje: "No se ha podido abrir la cámara.",
    })
  })
})

describe("preparar la foto", () => {
  it("una foto girada y grande se reduce por su lado largo ya orientado, sin girarla otra vez", async () => {
    // El archivo guarda 4000×3000 con orientación EXIF de retrato; el
    // manipulador la carga ya orientada: 3000×4000.
    const { contexto, referencias } = manipuladorFalso(3000, 4000)
    const { leer, cerrar } = archivoPreparado(jpegSintetico(245_760))

    const foto = await prepararFoto(ORIGINAL)

    expect(manipular).toHaveBeenCalledWith(ORIGINAL)
    expect(contexto.rotate).not.toHaveBeenCalled()
    expect(contexto.resize).toHaveBeenCalledTimes(1)
    expect(contexto.resize).toHaveBeenCalledWith({ height: LADO_MAXIMO_FOTO })
    // Se vuelve a codificar como JPEG: así no viajan EXIF ni ubicación.
    const final = referencias.at(-1)!
    expect(final.saveAsync).toHaveBeenCalledWith({ format: "jpeg", compress: CALIDAD_JPEG })
    expect(foto).toEqual({
      uri: SALIDA,
      tipoMime: "image/jpeg",
      bytes: 245_760,
      ancho: 1200,
      alto: 1600,
    })
    // Los bytes son los del archivo preparado, nunca los del original.
    expect(leer.mock.calls.map(([url]) => url)).toEqual([SALIDA])
    // Memoria nativa liberada: contexto, cada referencia y el blob leído.
    expect(contexto.release).toHaveBeenCalledTimes(1)
    for (const ref of referencias) expect(ref.release).toHaveBeenCalledTimes(1)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it("una foto apaisada grande se reduce por el ancho", async () => {
    const { contexto } = manipuladorFalso(4032, 3024)
    archivoPreparado(jpegSintetico(300_000))

    const foto = await prepararFoto(ORIGINAL)

    expect(contexto.resize).toHaveBeenCalledWith({ width: LADO_MAXIMO_FOTO })
    expect(foto).toMatchObject({ ancho: 1600, alto: 1200 })
  })

  it("una foto pequeña no se amplía, pero se vuelve a codificar como JPEG", async () => {
    const { contexto, referencias } = manipuladorFalso(900, 1200)
    archivoPreparado(jpegSintetico(80_000))

    const foto = await prepararFoto(ORIGINAL)

    expect(contexto.resize).not.toHaveBeenCalled()
    expect(referencias).toHaveLength(1)
    expect(referencias[0]!.saveAsync).toHaveBeenCalledWith({
      format: "jpeg",
      compress: CALIDAD_JPEG,
    })
    expect(foto).toEqual({
      uri: SALIDA,
      tipoMime: "image/jpeg",
      bytes: 80_000,
      ancho: 900,
      alto: 1200,
    })
  })

  it("si la foto preparada supera el máximo del servidor, se rechaza con un mensaje claro", async () => {
    manipuladorFalso(1200, 1600)
    archivoPreparado(jpegSintetico(BYTES_MAXIMOS_FOTO + 1))

    await expect(prepararFoto(ORIGINAL)).rejects.toThrow(
      new ErrorDeFoto("La foto ocupa demasiado (máximo 8 MB). Elige otra foto."),
    )
  })

  it("un formato que no se puede leer se rechaza sin fingir la conversión y libera el contexto", async () => {
    const { contexto } = manipuladorFalso(0, 0, new Error("ImageLoadingFailedException"))
    const { leer } = archivoPreparado(jpegSintetico(10))

    await expect(prepararFoto(ORIGINAL)).rejects.toThrow(
      new ErrorDeFoto("No se ha podido leer esta imagen. Elige otra foto o hazla con la cámara."),
    )
    expect(leer).not.toHaveBeenCalled()
    expect(contexto.release).toHaveBeenCalledTimes(1)
  })

  it("si el resultado no es un JPEG de verdad, no se da por convertido", async () => {
    manipuladorFalso(800, 600)
    // Cabecera PNG sintética donde debería haber un JPEG.
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const { cerrar } = archivoPreparado(png, "")

    await expect(prepararFoto(ORIGINAL)).rejects.toThrow(
      new ErrorDeFoto("No se ha podido convertir la foto a JPEG. Elige otra foto."),
    )
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it("un archivo vacío no se da por preparado", async () => {
    manipuladorFalso(800, 600)
    archivoPreparado(new Uint8Array(0))

    await expect(prepararFoto(ORIGINAL)).rejects.toThrow(ErrorDeFoto)
  })
})

describe("obtener y liberar", () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", "web")
  })

  it("elige, prepara y suelta el original; la preparada se suelta al terminar", async () => {
    const soltar = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    galeria.mockResolvedValue(elegida({ uri: "blob:http://localhost/original-sintetico" }))
    manipuladorFalso(1200, 900)
    jest.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        ({
          blob: async () =>
            new Blob([Uint8Array.from(jpegSintetico(50_000))], { type: "image/jpeg" }),
        }) as Response,
    )
    manipular.mockClear()

    const resultado = await obtenerFoto("galeria")

    expect(resultado).toEqual({
      tipo: "lista",
      foto: { uri: SALIDA, tipoMime: "image/jpeg", bytes: 50_000, ancho: 1200, alto: 900 },
    })
    expect(soltar).toHaveBeenCalledWith("blob:http://localhost/original-sintetico")

    liberarFoto("blob:http://localhost/preparada-sintetica")
    expect(soltar).toHaveBeenLastCalledWith("blob:http://localhost/preparada-sintetica")
  })

  it("si no se puede preparar, devuelve el motivo y también suelta el original", async () => {
    const soltar = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    galeria.mockResolvedValue(elegida({ uri: "blob:http://localhost/heic-sintetico" }))
    manipuladorFalso(0, 0, new Error("formato no admitido por el navegador"))

    expect(await obtenerFoto("galeria")).toEqual({
      tipo: "fallo",
      mensaje: "No se ha podido leer esta imagen. Elige otra foto o hazla con la cámara.",
    })
    expect(soltar).toHaveBeenCalledWith("blob:http://localhost/heic-sintetico")
  })

  it("cancelar no prepara nada", async () => {
    galeria.mockResolvedValue(cancelada)
    manipular.mockClear()

    expect(await obtenerFoto("galeria")).toEqual({ tipo: "cancelada" })
    expect(manipular).not.toHaveBeenCalled()
  })

  it("en web solo se revocan URL blob:; lo demás no se toca", () => {
    const soltar = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    mockDisco.borrados = []

    expect(liberarFoto("blob:http://localhost/preparada-sintetica")).toBe("liberada")
    expect(soltar).toHaveBeenCalledWith("blob:http://localhost/preparada-sintetica")
    expect(liberarFoto("data:image/jpeg;base64,/9j/sintetico")).toBe("ajena")
    expect(liberarFoto("https://almacen.example/medios/sintetico.jpg")).toBe("ajena")
    expect(soltar).toHaveBeenCalledTimes(1)
    expect(mockDisco.borrados).toEqual([])
  })
})

describe.each([
  { os: "android" as const, cache: "file:///data/user/0/app.sintetica/cache/" },
  {
    os: "ios" as const,
    cache: "file:///var/mobile/Containers/Data/Application/SINTETICA/Library/Caches/",
  },
])("liberar copias temporales en $os", ({ os, cache }) => {
  const seleccion = `${cache}ImagePicker/seleccion-sintetica.jpg`
  const preparada = (nombre: string): string => `${cache}ImageManipulator/${nombre}.jpg`

  beforeEach(() => {
    jest.replaceProperty(Platform, "OS", os)
    mockDisco.cache = cache
    mockDisco.archivos = new Set()
    mockDisco.fallos = new Set()
    mockDisco.borrados = []
  })

  /** Prepara una foto cuyo JPEG queda escrito en la caché sintética. */
  async function prepararEn(salida: string): ReturnType<typeof prepararFoto> {
    manipuladorFalso(1200, 900, undefined, salida)
    archivoPreparado(jpegSintetico(50_000))
    mockDisco.archivos.add(salida)
    return prepararFoto(seleccion)
  }

  it("la copia preparada en la caché propia se borra de verdad, una sola vez", async () => {
    const soltar = jest.spyOn(URL, "revokeObjectURL")
    const foto = await prepararEn(preparada("borrar"))

    expect(liberarFoto(foto.uri)).toBe("liberada")
    expect(mockDisco.archivos.has(foto.uri)).toBe(false)
    expect(mockDisco.borrados).toEqual([foto.uri])
    // Idempotente: repetir no borra nada más ni lanza.
    expect(liberarFoto(foto.uri)).toBe("yaNoEstaba")
    expect(mockDisco.borrados).toEqual([foto.uri])
    expect(soltar).not.toHaveBeenCalled()
  })

  it("elegir y preparar borra la copia de la selección y conserva la preparada hasta soltarla", async () => {
    galeria.mockResolvedValue(elegida({ uri: seleccion }))
    mockDisco.archivos.add(seleccion)
    manipuladorFalso(1200, 900, undefined, preparada("conservar"))
    archivoPreparado(jpegSintetico(50_000))
    mockDisco.archivos.add(preparada("conservar"))

    const resultado = await obtenerFoto("galeria")

    expect(resultado).toMatchObject({ tipo: "lista", foto: { uri: preparada("conservar") } })
    expect(mockDisco.borrados).toEqual([seleccion])
    // La preparada sigue disponible para subirla o reintentar.
    expect(mockDisco.archivos.has(preparada("conservar"))).toBe(true)

    expect(liberarFoto(preparada("conservar"))).toBe("liberada")
    expect(mockDisco.borrados).toEqual([seleccion, preparada("conservar")])
  })

  it.each([
    "content://media/external/images/media/42",
    "ph://SINTETICA-0042/L0/001",
    "file:///storage/emulated/0/DCIM/Camera/sintetica.jpg",
  ])("el original de la fototeca %s nunca se borra", async (original) => {
    galeria.mockResolvedValue(elegida({ uri: original }))
    mockDisco.archivos.add(original)
    manipuladorFalso(1200, 900, undefined, preparada("desde-original"))
    archivoPreparado(jpegSintetico(50_000))
    mockDisco.archivos.add(preparada("desde-original"))

    expect((await obtenerFoto("galeria")).tipo).toBe("lista")
    expect(manipular).toHaveBeenCalledWith(original)
    expect(liberarFoto(original)).toBe("ajena")
    expect(mockDisco.archivos.has(original)).toBe(true)
    expect(mockDisco.borrados).toEqual([])
  })

  it("no borra rutas que la app no ha creado en esta sesión", () => {
    const ajenas = [
      "content://media/external/images/media/7",
      "ph://SINTETICA-0007/L0/001",
      "https://almacen.example/medios/sintetico.jpg",
      "blob:http://localhost/sintetico",
      // En la carpeta del manipulador, pero no la ha preparado esta sesión.
      preparada("de-otra-sesion"),
      `${cache}ImageManipulator/../../files/datos-sinteticos.db`,
    ]
    for (const uri of ajenas) mockDisco.archivos.add(uri)

    for (const uri of ajenas) expect(liberarFoto(uri)).toBe("ajena")
    expect(mockDisco.borrados).toEqual([])
  })

  it("una salida fuera de las carpetas temporales propias no se da por propia", async () => {
    const fuera = [
      `${cache}../files/sintetica.jpg`,
      `${cache}ImageManipulator/%2e%2e/%2e%2e/files/sintetica.jpg`,
      `${cache}ImageManipulator/sub/sintetica.jpg`,
      `${cache}Otra/sintetica.jpg`,
      `${cache}sintetica.jpg`,
      "file:///storage/emulated/0/Pictures/sintetica.jpg",
    ]
    for (const salida of fuera) {
      const foto = await prepararEn(salida)
      expect(liberarFoto(foto.uri)).toBe("ajena")
      expect(mockDisco.archivos.has(salida)).toBe(true)
    }
    expect(mockDisco.borrados).toEqual([])
  })

  it("si el sistema ya vació la caché, liberar no lanza ni dice que borró", async () => {
    const foto = await prepararEn(preparada("ya-vaciada"))
    mockDisco.archivos.delete(foto.uri)

    expect(liberarFoto(foto.uri)).toBe("yaNoEstaba")
    expect(mockDisco.borrados).toEqual([])
  })

  it("un error del almacenamiento se informa como fallo, sin lanzar, y se puede reintentar", async () => {
    const foto = await prepararEn(preparada("bloqueada"))
    mockDisco.fallos.add(foto.uri)

    expect(liberarFoto(foto.uri)).toBe("fallo")
    expect(mockDisco.archivos.has(foto.uri)).toBe(true)
    expect(mockDisco.borrados).toEqual([])

    mockDisco.fallos.delete(foto.uri)
    expect(liberarFoto(foto.uri)).toBe("liberada")
    expect(mockDisco.borrados).toEqual([foto.uri])
  })

  it("si la preparada no es un JPEG válido, su copia se borra y no queda en la caché", async () => {
    manipuladorFalso(800, 600, undefined, preparada("no-jpeg"))
    archivoPreparado(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "")
    mockDisco.archivos.add(preparada("no-jpeg"))

    await expect(prepararFoto(seleccion)).rejects.toThrow(ErrorDeFoto)
    expect(mockDisco.borrados).toEqual([preparada("no-jpeg")])
  })

  it("un vídeo elegido por error se descarta y su copia se borra", async () => {
    const video = `${cache}ImagePicker/video-sintetico.mp4`
    galeria.mockResolvedValue(elegida({ uri: video, type: "video" }))
    mockDisco.archivos.add(video)

    expect(await elegirFoto("galeria")).toEqual({
      tipo: "fallo",
      mensaje: "Elige una foto, no un vídeo.",
    })
    expect(mockDisco.borrados).toEqual([video])
  })
})
