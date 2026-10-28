import { crc32, deflateSync } from "node:zlib"
import { formatoReal, sinMetadatos } from "./imagenes.js"

// Imágenes sintéticas mínimas, construidas byte a byte: ninguna foto ni persona
// real. PNG contiene filas comprimidas válidas; no hace falta reconstruir píxeles.

const texto = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, "latin1"))
const unir = (...partes: Uint8Array[]): Uint8Array => Uint8Array.from(Buffer.concat(partes))
const bytes = (...valores: number[]): Uint8Array => Uint8Array.from(valores)
const contiene = (datos: Uint8Array, s: string): boolean =>
  Buffer.from(datos).includes(Buffer.from(s, "latin1"))

function entero(n: number, octetos: 2 | 4, littleEndian = false): Uint8Array {
  const salida = new Uint8Array(octetos)
  const vista = new DataView(salida.buffer)
  if (octetos === 2) vista.setUint16(0, n, littleEndian)
  else vista.setUint32(0, n, littleEndian)
  return salida
}

// Cabecera TIFF con una sola etiqueta GPSInfo (0x8825) y coordenadas ficticias.
const exifFicticio = unir(
  texto("MM\0*"),
  entero(8, 4),
  entero(1, 2),
  entero(0x8825, 2),
  entero(4, 2),
  entero(1, 4),
  entero(26, 4),
  entero(0, 4),
  texto("GPS 41.3874N 2.1686E"),
)
const xmpFicticio = texto('<x:xmpmeta xmlns:x="adobe:ns:meta/">GPSLatitude 41,23N</x:xmpmeta>')
// Caja JUMBF de credenciales de contenido C2PA, con ubicación y autor ficticios.
const c2paFicticio = unir(entero(40, 4), texto("jumb"), texto("c2pa stds.exif GPS autor"))

// ---------------------------------------------------------------- JPEG

const segmento = (marcador: number, datos: Uint8Array): Uint8Array =>
  unir(bytes(0xff, marcador), entero(datos.length + 2, 2), datos)

const SOI = bytes(0xff, 0xd8)
const EOI = bytes(0xff, 0xd9)
const TEM = bytes(0xff, 0x01)
const app0 = segmento(0xe0, unir(texto("JFIF\0"), bytes(1, 1, 0, 0, 1, 0, 1, 0, 0)))
const app0Jfxx = segmento(0xe0, unir(texto("JFXX\0"), bytes(0x13, 1, 1), texto("GPS")))
const app1Exif = segmento(0xe1, unir(texto("Exif\0\0"), exifFicticio))
const app1Xmp = segmento(0xe1, unir(texto("http://ns.adobe.com/xap/1.0/\0"), xmpFicticio))
const app2Icc = segmento(0xe2, unir(texto("ICC_PROFILE\0"), bytes(1, 1), texto("perfil")))
const app2Mpf = segmento(0xe2, unir(texto("MPF\0"), texto("MM\0*"), entero(8, 4)))
const app2Fpxr = segmento(0xe2, unir(texto("FPXR\0"), texto("GPS")))
const app5 = segmento(0xe5, texto("HPQ-Capture\0GPS"))
const app11 = segmento(0xeb, unir(texto("JP"), bytes(0, 1), entero(1, 4), c2paFicticio))
const app13 = segmento(0xed, texto("Photoshop 3.0\x008BIM\x04\x04IPTC Barcelona"))
const app14 = segmento(0xee, unir(texto("Adobe"), bytes(0, 100, 0, 0, 0, 0, 1)))
const app14Otro = segmento(0xee, texto("Ducky GPS"))
const jpg0 = segmento(0xf0, texto("extension GPS"))
const com = segmento(0xfe, texto("Comentario de la camara"))
const dqt = segmento(0xdb, unir(bytes(0), new Uint8Array(64).fill(1)))
const sof0 = segmento(0xc0, bytes(8, 0, 1, 0, 1, 1, 1, 0x11, 0))
const sof2 = segmento(0xc2, bytes(8, 0, 1, 0, 1, 1, 1, 0x11, 0))
const dht = segmento(0xc4, unir(bytes(0), new Uint8Array(16)))
const dac = segmento(0xcc, bytes(0x00, 0x10))
const dri = segmento(0xdd, entero(4, 2))
const sos = segmento(0xda, bytes(1, 1, 0, 0, 0x3f, 0))
// Datos comprimidos con un 0xFF escapado (FF 00) y un reinicio (FF D0).
const escaneo = bytes(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78)

const jpegLimpio = unir(SOI, app0, dqt, sof0, dht, sos, escaneo, EOI)

describe("sinMetadatos · JPEG (lista blanca)", () => {
  it("conserva solo lo necesario para decodificar y quita todo lo demás", () => {
    const entrada = unir(
      SOI,
      app0,
      app1Exif,
      app1Xmp,
      app2Icc,
      app2Mpf,
      app5,
      app11,
      app13,
      app14,
      com,
      jpg0,
      TEM,
      dqt,
      sof0,
      dht,
      dac,
      dri,
      sos,
      escaneo,
      EOI,
    )

    const salida = sinMetadatos(entrada, "image/jpeg")

    const rastros = ["GPS", "Exif", "xmpmeta", "MPF", "HPQ", "jumb", "c2pa", "8BIM", "Comentario"]
    for (const rastro of rastros) {
      expect(contiene(salida, rastro)).toBe(false)
    }
    expect(salida).toEqual(
      unir(SOI, app0, app2Icc, app14, dqt, sof0, dht, dac, dri, sos, escaneo, EOI),
    )
    expect(formatoReal(salida)).toBe("image/jpeg")
  })

  it("solo admite APP0 JFIF, APP2 ICC_PROFILE y APP14 Adobe", () => {
    const entrada = unir(SOI, app0Jfxx, app2Fpxr, app14Otro, dqt, sof0, sos, escaneo, EOI)

    const salida = sinMetadatos(entrada, "image/jpeg")

    expect(salida).toEqual(unir(SOI, dqt, sof0, sos, escaneo, EOI))
    expect(contiene(salida, "GPS")).toBe(false)
  })

  it("devuelve igual, en una copia nueva, un JPEG que no tenía metadatos", () => {
    const entrada = jpegLimpio.slice()

    const salida = sinMetadatos(entrada, "image/jpeg")

    expect(salida).toEqual(jpegLimpio)
    expect(salida).not.toBe(entrada)
    expect(salida.buffer).not.toBe(entrada.buffer)
    expect(entrada).toEqual(jpegLimpio)
  })

  it("lee bien una vista que no empieza al principio de su búfer", () => {
    const grande = unir(bytes(0xaa, 0xbb, 0xcc), SOI, app1Exif, dqt, sof0, sos, escaneo, EOI)
    const vista = grande.subarray(3)

    expect(sinMetadatos(vista, "image/jpeg")).toEqual(unir(SOI, dqt, sof0, sos, escaneo, EOI))
  })

  it("tolera bytes de relleno 0xFF antes de un marcador", () => {
    const relleno = bytes(0xff, 0xff)
    const entrada = unir(SOI, relleno, app1Exif, relleno, dqt, sof0, sos, escaneo, EOI)

    expect(sinMetadatos(entrada, "image/jpeg")).toEqual(
      unir(SOI, relleno, dqt, sof0, sos, escaneo, EOI),
    )
  })

  it("en un JPEG progresivo conserva los escaneos y quita lo no admitido entre ellos", () => {
    const segundoEscaneo = bytes(0x9a, 0xff, 0x00, 0xbc)
    const entrada = unir(
      SOI,
      dqt,
      sof2,
      sos,
      escaneo,
      dht,
      com,
      app11,
      app5,
      dri,
      sos,
      segundoEscaneo,
      EOI,
    )

    const salida = sinMetadatos(entrada, "image/jpeg")

    expect(salida).toEqual(unir(SOI, dqt, sof2, sos, escaneo, dht, dri, sos, segundoEscaneo, EOI))
    expect(contiene(salida, "c2pa")).toBe(false)
  })

  it("descarta lo que va tras el final de la imagen y el índice MPF que lo señalaba", () => {
    // Fotos en movimiento y MPF añaden tras EOI otra imagen o un vídeo con su propio GPS.
    const anexo = unir(SOI, app1Exif, dqt, sof0, sos, escaneo, EOI, texto("MotionPhoto GPS"))
    const entrada = unir(SOI, app0, app2Mpf, dqt, sof0, sos, escaneo, EOI, anexo)

    const salida = sinMetadatos(entrada, "image/jpeg")

    expect(salida).toEqual(unir(SOI, app0, dqt, sof0, sos, escaneo, EOI))
    expect(contiene(salida, "GPS")).toBe(false)
  })

  it("conserva hasta el final un JPEG truncado tras el escaneo", () => {
    const entrada = unir(SOI, app1Exif, dqt, sof0, sos, escaneo)

    expect(sinMetadatos(entrada, "image/jpeg")).toEqual(unir(SOI, dqt, sof0, sos, escaneo))
  })

  it.each([
    ["no empieza por FF D8", unir(bytes(0xff, 0xd9), app0, sos, escaneo, EOI)],
    ["un segmento se sale del archivo", unir(SOI, bytes(0xff, 0xe0, 0x00, 0x40, 1, 2, 3))],
    ["la longitud del segmento es menor que 2", unir(SOI, bytes(0xff, 0xe0, 0x00, 0x01), sos)],
    ["falta la longitud del segmento", unir(SOI, bytes(0xff, 0xe0, 0x00))],
    ["un segmento descartado se sale del archivo", unir(SOI, bytes(0xff, 0xeb, 0x00, 0x40, 1))],
    ["no hay SOS antes del final", unir(SOI, app0, dqt, sof0, EOI)],
    ["el archivo acaba antes de SOS", unir(SOI, app0, dqt)],
    ["hay bytes sueltos donde va un marcador", unir(SOI, bytes(0x00, 0x11), app0, sos, EOI)],
    ["el archivo acaba en relleno", unir(SOI, app0, bytes(0xff, 0xff))],
    ["un segundo SOI", unir(SOI, SOI, app0, sos, escaneo, EOI)],
  ])("rechaza una estructura rota: %s", (_caso, entrada) => {
    expect(() => sinMetadatos(entrada, "image/jpeg")).toThrow("La imagen no es un JPEG válido")
  })
})

// ---------------------------------------------------------------- PNG

const FIRMA_PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

function bloquePng(tipo: string, datos: Uint8Array): Uint8Array {
  const tipoYDatos = unir(texto(tipo), datos)
  return unir(entero(datos.length, 4), tipoYDatos, entero(crc32(tipoYDatos), 4))
}

const ihdr = bloquePng("IHDR", unir(entero(1, 4), entero(1, 4), bytes(8, 2, 0, 0, 0)))
const iccpPng = bloquePng("iCCP", unir(texto("ICC Profile\0"), bytes(0, 0x78, 0x9c, 0x03, 0x00)))
const gama = bloquePng("gAMA", entero(45455, 4))
const srgb = bloquePng("sRGB", bytes(0))
const phys = bloquePng("pHYs", unir(entero(2835, 4), entero(2835, 4), bytes(1)))
const textoPng = bloquePng("tEXt", texto("Comment\0Tomada en casa GPS"))
const zTxt = bloquePng("zTXt", unir(texto("Author\0\0"), bytes(0x78, 0x9c, 0x03, 0x00)))
const iTxt = bloquePng("iTXt", unir(texto("XML:com.adobe.xmp\0\0\0\0\0"), xmpFicticio))
const exifPng = bloquePng("eXIf", exifFicticio)
const tiempo = bloquePng("tIME", bytes(0x07, 0xea, 9, 24, 10, 30, 0))
const caBX = bloquePng("caBX", c2paFicticio)
const privado = bloquePng("prVt", texto("bloque privado GPS"))
const filaRgb = bytes(0, 255, 255, 255)
const rgbComprimido = Uint8Array.from(deflateSync(filaRgb))
const idat = bloquePng("IDAT", rgbComprimido)
const iend = bloquePng("IEND", bytes())

function cabeceraPng(ancho: number, alto: number, profundidad = 8, color = 2, entrelazado = 0) {
  return bloquePng(
    "IHDR",
    unir(entero(ancho, 4), entero(alto, 4), bytes(profundidad, color, 0, 0, entrelazado)),
  )
}

function pngComprimido(cabecera: Uint8Array, comprimido: Uint8Array): Uint8Array {
  return unir(FIRMA_PNG, cabecera, bloquePng("IDAT", comprimido), iend)
}

const filasAdam7 = unir(
  bytes(0, 0, 0, 0), // 1: 1 fila de 1 píxel RGB
  bytes(1, 0, 0, 0), // 2: 1 fila de 1 píxel
  bytes(2, 0, 0, 0, 0, 0, 0), // 3: 1 fila de 2 píxeles
  ...[3, 4].map((filtro) => unir(bytes(filtro), new Uint8Array(6))), // 4: 2 filas de 2
  ...[0, 1].map((filtro) => unir(bytes(filtro), new Uint8Array(12))), // 5: 2 filas de 4
  ...[2, 3, 4, 0].map((filtro) => unir(bytes(filtro), new Uint8Array(12))), // 6: 4 filas de 4
  ...[1, 2, 3, 4].map((filtro) => unir(bytes(filtro), new Uint8Array(24))), // 7: 4 filas de 8
)

const adlerIncorrecto = rgbComprimido.slice()
adlerIncorrecto[adlerIncorrecto.length - 1] = adlerIncorrecto[adlerIncorrecto.length - 1]! ^ 1
const filtroAdam7Incorrecto = filasAdam7.slice()
filtroAdam7Incorrecto[107] = 5 // Primera fila de la última pasada.

const pngConMetadatos = unir(
  FIRMA_PNG,
  ihdr,
  iccpPng,
  gama,
  textoPng,
  exifPng,
  srgb,
  tiempo,
  zTxt,
  phys,
  iTxt,
  caBX,
  privado,
  idat,
  iend,
)

/** Recorre los bloques de un PNG y comprueba el CRC de cada uno. */
function bloquesPng(png: Uint8Array): string[] {
  const vista = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const tipos: string[] = []
  for (let pos = 8; pos < png.length;) {
    const longitud = vista.getUint32(pos)
    const tipoYDatos = png.subarray(pos + 4, pos + 8 + longitud)
    expect(vista.getUint32(pos + 8 + longitud)).toBe(crc32(tipoYDatos))
    tipos.push(Buffer.from(tipoYDatos.subarray(0, 4)).toString("latin1"))
    pos += 12 + longitud
  }
  return tipos
}

describe("sinMetadatos · PNG (lista blanca)", () => {
  it("rechaza el PNG de 58 bytes con IHDR y CRC válidos pero IDAT 01 ilegible", () => {
    const entrada = pngComprimido(ihdr, bytes(1))
    expect(entrada).toHaveLength(58)
    expect(bloquesPng(entrada)).toEqual(["IHDR", "IDAT", "IEND"])
    expect(() => sinMetadatos(entrada, "image/png")).toThrow("La imagen no es un PNG válido")
  })

  it.each([
    ["zlib truncado", pngComprimido(ihdr, rgbComprimido.subarray(0, rgbComprimido.length - 1))],
    ["Adler incorrecto", pngComprimido(ihdr, adlerIncorrecto)],
    ["bytes tras el flujo zlib", pngComprimido(ihdr, unir(rgbComprimido, bytes(1)))],
    ["dos flujos zlib", pngComprimido(ihdr, unir(rgbComprimido, rgbComprimido))],
    ["fila incompleta", pngComprimido(ihdr, deflateSync(bytes(0, 1, 2)))],
    ["fila demasiado larga", pngComprimido(ihdr, deflateSync(bytes(0, 1, 2, 3, 4)))],
    ["filtro 5", pngComprimido(ihdr, deflateSync(bytes(5, 1, 2, 3)))],
    ["filtro 255", pngComprimido(ihdr, deflateSync(bytes(255, 1, 2, 3)))],
    [
      "filtro inválido en la segunda fila",
      pngComprimido(cabeceraPng(1, 2), deflateSync(bytes(0, 0, 0, 0, 5, 0, 0, 0))),
    ],
    ["expansión excesiva para IHDR", pngComprimido(ihdr, deflateSync(new Uint8Array(100_000)))],
    [
      "Adam7 con una fila incompleta",
      pngComprimido(cabeceraPng(8, 8, 8, 2, 1), deflateSync(filasAdam7.subarray(0, 206))),
    ],
    [
      "Adam7 con filtro inválido en la última pasada",
      pngComprimido(cabeceraPng(8, 8, 8, 2, 1), deflateSync(filtroAdam7Incorrecto)),
    ],
    [
      "dimensiones que exigen más de 64 MiB",
      pngComprimido(cabeceraPng(1, 40_000_000), rgbComprimido),
    ],
    [
      "dimensiones cuyo producto no es un entero seguro",
      pngComprimido(cabeceraPng(0x7fffffff, 0x7fffffff, 16, 6), rgbComprimido),
    ],
  ])("rechaza datos PNG comprimidos inválidos o excesivos: %s", (_caso, entrada) => {
    expect(() => sinMetadatos(entrada, "image/png")).toThrow("La imagen no es un PNG válido")
  })

  it("admite el flujo zlib partido incluso dentro de su cabecera y checksum, con IDAT vacíos", () => {
    const entrada = unir(
      FIRMA_PNG,
      ihdr,
      bloquePng("IDAT", bytes()),
      ...Array.from(rgbComprimido, (byte) => bloquePng("IDAT", bytes(byte))),
      bloquePng("IDAT", bytes()),
      iend,
    )
    expect(sinMetadatos(entrada, "image/png")).toEqual(entrada)
  })

  it("admite los cinco filtros de PNG sin cambiar la imagen comprimida", () => {
    const filas = unir(...[0, 1, 2, 3, 4].map((filtro) => bytes(filtro, 0, 0, 0)))
    const entrada = pngComprimido(cabeceraPng(1, 5), deflateSync(filas))
    expect(sinMetadatos(entrada, "image/png")).toEqual(entrada)
  })

  it.each([
    [1, 0, 1],
    [2, 0, 1],
    [4, 0, 2],
    [8, 0, 3],
    [16, 0, 6],
    [8, 2, 9],
    [16, 2, 18],
    [1, 3, 1],
    [2, 3, 1],
    [4, 3, 2],
    [8, 3, 3],
    [8, 4, 6],
    [16, 4, 12],
    [8, 6, 12],
    [16, 6, 24],
  ])("admite 3×2 píxeles con profundidad %i y color %i", (profundidad, color, bytesFila) => {
    const fila = new Uint8Array(bytesFila + 1)
    const entrada = unir(
      FIRMA_PNG,
      cabeceraPng(3, 2, profundidad, color),
      ...(color === 3 ? [bloquePng("PLTE", bytes(0, 0, 0))] : []),
      bloquePng("IDAT", deflateSync(unir(fila, fila))),
      iend,
    )
    expect(sinMetadatos(entrada, "image/png")).toEqual(entrada)
  })

  it("admite las siete pasadas Adam7 de 8×8 RGB con sus filtros", () => {
    expect(filasAdam7).toHaveLength(207)
    const entrada = pngComprimido(cabeceraPng(8, 8, 8, 2, 1), deflateSync(filasAdam7))
    expect(sinMetadatos(entrada, "image/png")).toEqual(entrada)
  })

  it.each([
    [1, 1, bytes(0, 0, 0, 0)],
    [2, 3, new Uint8Array(23)],
  ])("admite Adam7 %i×%i omitiendo las pasadas vacías", (ancho, alto, filas) => {
    const entrada = pngComprimido(cabeceraPng(ancho, alto, 8, 2, 1), deflateSync(filas))
    expect(sinMetadatos(entrada, "image/png")).toEqual(entrada)
  })

  it.each([
    ["IHDR vacío", unir(FIRMA_PNG, bloquePng("IHDR", bytes()), iend)],
    ["sin IDAT", unir(FIRMA_PNG, ihdr, iend)],
    ["IDAT vacío", unir(FIRMA_PNG, ihdr, bloquePng("IDAT", bytes()), iend)],
    [
      "IDAT vacío seguido de IDAT separado",
      unir(FIRMA_PNG, ihdr, bloquePng("IDAT", bytes()), textoPng, idat, iend),
    ],
    [
      "PLTE tras IDAT vacío",
      unir(
        FIRMA_PNG,
        ihdr,
        bloquePng("IDAT", bytes()),
        bloquePng("PLTE", bytes(1, 2, 3)),
        idat,
        iend,
      ),
    ],
    ["IHDR duplicado", unir(FIRMA_PNG, ihdr, ihdr, idat, iend)],
    [
      "dimensión cero",
      unir(
        FIRMA_PNG,
        bloquePng("IHDR", unir(entero(0, 4), entero(1, 4), bytes(8, 2, 0, 0, 0))),
        idat,
        iend,
      ),
    ],
    [
      "profundidad incompatible",
      unir(
        FIRMA_PNG,
        bloquePng("IHDR", unir(entero(1, 4), entero(1, 4), bytes(1, 2, 0, 0, 0))),
        idat,
        iend,
      ),
    ],
    [
      "paleta indexada ausente",
      unir(
        FIRMA_PNG,
        bloquePng("IHDR", unir(entero(1, 4), entero(1, 4), bytes(8, 3, 0, 0, 0))),
        idat,
        iend,
      ),
    ],
    ["IDAT no consecutivos", unir(FIRMA_PNG, ihdr, idat, textoPng, idat, iend)],
    ["IEND con datos", unir(FIRMA_PNG, ihdr, idat, bloquePng("IEND", bytes(1)))],
    [
      "CRC incorrecto",
      unir(
        FIRMA_PNG,
        ihdr,
        idat.subarray(0, idat.length - 1),
        bytes(idat[idat.length - 1]! ^ 1),
        iend,
      ),
    ],
    ["bloque crítico desconocido", unir(FIRMA_PNG, ihdr, bloquePng("ABCD", bytes(1)), idat, iend)],
  ])("rechaza PNG sin estructura de imagen válida: %s", (_caso, entrada) => {
    expect(() => sinMetadatos(entrada, "image/png")).toThrow("La imagen no es un PNG válido")
  })

  it("conserva solo los bloques de imagen y color, con su CRC, y quita todo lo demás", () => {
    const salida = sinMetadatos(pngConMetadatos, "image/png")

    const rastros = ["GPS", "eXIf", "tEXt", "zTXt", "iTXt", "xmpmeta", "tIME", "caBX", "c2pa"]
    for (const rastro of [...rastros, "prVt"]) {
      expect(contiene(salida, rastro)).toBe(false)
    }
    expect(salida).toEqual(unir(FIRMA_PNG, ihdr, iccpPng, gama, srgb, phys, idat, iend))
    expect(bloquesPng(salida)).toEqual(["IHDR", "iCCP", "gAMA", "sRGB", "pHYs", "IDAT", "IEND"])
  })

  it("devuelve igual un PNG sin metadatos", () => {
    const limpio = unir(FIRMA_PNG, ihdr, idat, iend)

    expect(sinMetadatos(limpio, "image/png")).toEqual(limpio)
  })

  it("descarta lo que va detrás de IEND", () => {
    const entrada = unir(FIRMA_PNG, ihdr, idat, iend, texto("anexo con GPS"))

    expect(sinMetadatos(entrada, "image/png")).toEqual(unir(FIRMA_PNG, ihdr, idat, iend))
  })

  it.each([
    ["no tiene la firma PNG", unir(bytes(0x89, 0x50), ihdr, idat, iend)],
    ["no termina en IEND", unir(FIRMA_PNG, ihdr, idat)],
    ["solo tiene la firma", FIRMA_PNG],
    ["un bloque se sale del archivo", unir(FIRMA_PNG, ihdr, idat.subarray(0, idat.length - 2))],
    ["la cabecera de un bloque está cortada", unir(FIRMA_PNG, ihdr, bytes(0, 0, 0))],
    ["el primer bloque no es IHDR", unir(FIRMA_PNG, idat, ihdr, iend)],
    [
      "un tipo de bloque no es texto",
      unir(FIRMA_PNG, ihdr, entero(0, 4), bytes(1, 2, 3, 4), entero(0, 4), iend),
    ],
  ])("rechaza una estructura rota: %s", (_caso, entrada) => {
    expect(() => sinMetadatos(entrada, "image/png")).toThrow("La imagen no es un PNG válido")
  })
})

// ---------------------------------------------------------------- WebP

function bloqueRiff(tipo: string, datos: Uint8Array): Uint8Array {
  const relleno = datos.length % 2 === 1 ? bytes(0) : bytes()
  return unir(texto(tipo), entero(datos.length, 4, true), datos, relleno)
}

function webp(...bloques: Uint8Array[]): Uint8Array {
  const cuerpo = unir(texto("WEBP"), ...bloques)
  return unir(texto("RIFF"), entero(cuerpo.length, 4, true), cuerpo)
}

const BIT_ICC = 0x20
const BIT_ALFA = 0x10
const BIT_EXIF = 0x08
const BIT_XMP = 0x04
const BIT_ANIMACION = 0x02
const vp8x = (flags: number): Uint8Array =>
  bloqueRiff("VP8X", bytes(flags, 0, 0, 0, 0, 0, 0, 0, 0, 0))
const iccp = bloqueRiff("ICCP", texto("perfil"))
// Fotograma VP8 ficticio de longitud impar, para cubrir el byte de relleno.
const vp8 = bloqueRiff("VP8 ", bytes(0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01))
const alph = bloqueRiff("ALPH", bytes(0, 1, 2))
const anim = bloqueRiff("ANIM", bytes(0, 0, 0, 0, 0, 0))
const exifWebp = bloqueRiff("EXIF", exifFicticio)
const xmpWebp = bloqueRiff("XMP ", xmpFicticio)
const c2paWebp = bloqueRiff("C2PA", c2paFicticio)
const desconocido = bloqueRiff("ABCD", texto("bloque desconocido GPS"))
// Fotograma de animación: cabecera de 16 bytes (posición, tamaño, duración) y subbloques.
const anmf = (...subbloques: Uint8Array[]): Uint8Array =>
  bloqueRiff("ANMF", unir(bytes(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0), ...subbloques))

const webpConMetadatos = webp(
  vp8x(BIT_ICC | BIT_EXIF | BIT_XMP),
  iccp,
  vp8,
  exifWebp,
  xmpWebp,
  c2paWebp,
  desconocido,
)

describe("sinMetadatos · WebP (lista blanca)", () => {
  it("quita EXIF, XMP, C2PA y desconocidos, limpia VP8X y rehace el tamaño RIFF", () => {
    const salida = sinMetadatos(webpConMetadatos, "image/webp")

    for (const rastro of ["GPS", "EXIF", "XMP ", "xmpmeta", "C2PA", "jumb", "ABCD"]) {
      expect(contiene(salida, rastro)).toBe(false)
    }
    expect(salida).toEqual(webp(vp8x(BIT_ICC), iccp, vp8))
    const vista = new DataView(salida.buffer, salida.byteOffset, salida.byteLength)
    expect(vista.getUint32(4, true)).toBe(salida.length - 8)
    expect(salida[20]).toBe(BIT_ICC)
  })

  it("en una animación limpia también los subbloques de cada fotograma", () => {
    const entrada = webp(
      vp8x(BIT_ANIMACION | BIT_ALFA | BIT_EXIF),
      anim,
      anmf(alph, vp8, desconocido),
      anmf(vp8, xmpWebp),
      exifWebp,
    )

    const salida = sinMetadatos(entrada, "image/webp")

    expect(salida).toEqual(webp(vp8x(BIT_ANIMACION | BIT_ALFA), anim, anmf(alph, vp8), anmf(vp8)))
    expect(contiene(salida, "GPS")).toBe(false)
  })

  it("devuelve igual un WebP simple sin metadatos", () => {
    const limpio = webp(vp8)

    expect(sinMetadatos(limpio, "image/webp")).toEqual(limpio)
  })

  it("descarta lo que va detrás del contenedor RIFF", () => {
    const limpio = webp(vp8x(0), vp8)

    expect(sinMetadatos(unir(limpio, texto("anexo GPS")), "image/webp")).toEqual(limpio)
  })

  it.each([
    ["no es RIFF/WEBP", unir(texto("RIFF"), entero(4, 4, true), texto("WAVE"))],
    ["el tamaño RIFF supera el archivo", webpConMetadatos.subarray(0, webpConMetadatos.length - 1)],
    ["no tiene ningún bloque", webp()],
    ["un bloque se sale del contenedor", webp(unir(texto("VP8 "), entero(50, 4, true), bytes(1)))],
    [
      "falta el relleno de un bloque impar",
      webp(unir(texto("VP8 "), entero(1, 4, true), bytes(7))),
    ],
    ["la cabecera de un bloque está cortada", webp(vp8, texto("EXI"))],
    ["un bloque descartado se sale del contenedor", webp(vp8, texto("ABCD"), entero(9, 4, true))],
    ["el primer bloque no es de imagen", webp(exifWebp, vp8)],
    ["VP8X está incompleto", webp(bloqueRiff("VP8X", bytes(BIT_EXIF, 0)), vp8)],
    ["un fotograma está incompleto", webp(vp8x(BIT_ANIMACION), anim, bloqueRiff("ANMF", bytes(1)))],
    [
      "un subbloque se sale de su fotograma",
      webp(vp8x(BIT_ANIMACION), anim, anmf(texto("VP8 "), entero(100, 4, true), bytes(1, 2))),
    ],
  ])("rechaza una estructura rota: %s", (_caso, entrada) => {
    expect(() => sinMetadatos(entrada, "image/webp")).toThrow("La imagen no es un WebP válido")
  })
})

// ---------------------------------------------------------------- Firma

describe("formatoReal", () => {
  it("reconoce JPEG, PNG y WebP por su firma", () => {
    expect(formatoReal(jpegLimpio)).toBe("image/jpeg")
    expect(formatoReal(pngConMetadatos)).toBe("image/png")
    expect(formatoReal(webpConMetadatos)).toBe("image/webp")
  })

  it("no admite GIF, texto, archivos vacíos ni otros RIFF", () => {
    expect(formatoReal(texto("GIF89a\x01\0\x01\0\0\0\0;"))).toBeNull()
    expect(formatoReal(texto("hola, esto no es una imagen"))).toBeNull()
    expect(formatoReal(new Uint8Array())).toBeNull()
    expect(formatoReal(bytes(0xff, 0xd8))).toBeNull()
    expect(formatoReal(unir(texto("RIFF"), entero(4, 4, true), texto("WAVE")))).toBeNull()
  })

  it("mira los bytes y no el tipo declarado: un PNG presentado como JPEG es PNG", () => {
    const declarado = "image/jpeg"
    expect(formatoReal(pngConMetadatos)).toBe("image/png")
    expect(() => sinMetadatos(pngConMetadatos, declarado)).toThrow("no es un JPEG válido")
  })
})
