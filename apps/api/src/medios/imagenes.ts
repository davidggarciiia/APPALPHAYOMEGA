/**
 * Formato real y limpieza de metadatos de las fotos privadas (ADR 0005).
 *
 * La limpieza es por LISTA BLANCA, porque son datos de salud: de cada formato se
 * conserva solo lo necesario para decodificar la imagen y mostrar bien su color,
 * y todo lo demás se elimina (Exif con GPS, XMP, IPTC, comentarios, C2PA, fechas,
 * bloques privados o desconocidos), también lo que vaya tras el final de la
 * imagen. Añadir algo a una lista blanca exige comprobar que no puede llevar
 * datos personales.
 *
 * Solo recorre la estructura del contenedor: nunca decodifica ni recomprime
 * píxeles, no escribe en disco y no registra el contenido. Los errores dicen qué
 * falla en la estructura, nunca qué bytes había.
 */

export type FormatoImagen = "image/jpeg" | "image/png" | "image/webp"

const FIRMA_JPEG = [0xff, 0xd8, 0xff] as const
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** Formato real por su firma de bytes, o null si no es ninguno admitido. */
export function formatoReal(bytes: Uint8Array): FormatoImagen | null {
  if (empiezaPor(bytes, FIRMA_JPEG)) return "image/jpeg"
  if (empiezaPor(bytes, FIRMA_PNG)) return "image/png"
  if (esRiffWebp(bytes)) return "image/webp"
  return null
}

/**
 * Copia de la imagen sin metadatos que puedan llevar ubicación u otros datos
 * personales, conservando los píxeles tal cual. Lanza un Error con mensaje en
 * español si la estructura del archivo no es válida para su formato.
 */
export function sinMetadatos(bytes: Uint8Array, formato: FormatoImagen): Uint8Array {
  switch (formato) {
    case "image/jpeg":
      return jpegSinMetadatos(bytes)
    case "image/png":
      return pngSinMetadatos(bytes)
    case "image/webp":
      return webpSinMetadatos(bytes)
  }
}

// ---------------------------------------------------------------- JPEG

const MARCADOR = 0xff
const TEM = 0x01
const DHT = 0xc4
const JPG = 0xc8
const DAC = 0xcc
const SOI = 0xd8
const EOI = 0xd9
const SOS = 0xda
const DQT = 0xdb
const DRI = 0xdd
const APP0 = 0xe0
const APP2 = 0xe2
const APP14 = 0xee
const JFIF = codigos("JFIF\0")
const ICC_PROFILE = codigos("ICC_PROFILE\0")
const ADOBE = codigos("Adobe")

const esRst = (marcador: number): boolean => marcador >= 0xd0 && marcador <= 0xd7

/** SOF0–SOF15; C4 (DHT), C8 (reservado) y CC (DAC) no son cabeceras de fotograma. */
const esSof = (marcador: number): boolean =>
  marcador >= 0xc0 && marcador <= 0xcf && marcador !== DHT && marcador !== JPG && marcador !== DAC

/**
 * Lista blanca de segmentos con longitud: tablas, cabeceras de fotograma y de
 * escaneo, y solo los APPn que cambian cómo se ve la imagen (JFIF, perfil ICC y
 * transformación de color de Adobe). Cualquier otro APPn (Exif, XMP, MPF, C2PA,
 * IPTC…), COM o marcador desconocido se descarta.
 */
function segmentoJpegAdmitido(marcador: number, datos: Uint8Array): boolean {
  switch (marcador) {
    case APP0:
      return empiezaPor(datos, JFIF)
    case APP2:
      return empiezaPor(datos, ICC_PROFILE)
    case APP14:
      return empiezaPor(datos, ADOBE)
    case DQT:
    case DHT:
    case DAC:
    case DRI:
    case SOS:
      return true
    default:
      return esSof(marcador)
  }
}

function jpegSinMetadatos(bytes: Uint8Array): Uint8Array {
  if (!empiezaPor(bytes, FIRMA_JPEG)) throw noValida("JPEG", "no empieza por la marca de inicio")
  const vista = vistaDe(bytes)
  const partes: Uint8Array[] = [bytes.subarray(0, 2)]
  let pos = 2
  let trasSos = false

  while (pos < bytes.length) {
    if (trasSos) {
      // Datos comprimidos: se copian íntegros hasta el siguiente marcador real.
      const fin = finDeDatosComprimidos(bytes, pos)
      partes.push(bytes.subarray(pos, fin))
      pos = fin
      if (pos >= bytes.length) break
    }

    const inicio = pos
    if (bytes[pos] !== MARCADOR) throw noValida("JPEG", "falta un marcador donde se esperaba")
    while (bytes[pos] === MARCADOR) pos++ // relleno
    if (pos >= bytes.length) throw noValida("JPEG", "el archivo acaba en mitad de un marcador")
    const marcador = vista.getUint8(pos++)

    if (marcador === EOI) {
      if (!trasSos) throw noValida("JPEG", "falta el inicio del escaneo (SOS)")
      // Lo que venga detrás (fotos en movimiento, imágenes MPF) no es esta imagen.
      partes.push(bytes.subarray(inicio, pos))
      return unir(partes)
    }
    if (esRst(marcador) || marcador === TEM) {
      // Sin longitud: RSTn se conserva; TEM no hace falta para decodificar.
      if (esRst(marcador)) partes.push(bytes.subarray(inicio, pos))
      continue
    }
    if (marcador === SOI || marcador === 0x00) {
      throw noValida("JPEG", "hay un marcador fuera de lugar")
    }
    if (pos + 2 > bytes.length) throw noValida("JPEG", "un segmento se sale del archivo")
    const longitud = vista.getUint16(pos)
    const fin = pos + longitud
    if (longitud < 2 || fin > bytes.length) {
      throw noValida("JPEG", "un segmento se sale del archivo")
    }

    if (segmentoJpegAdmitido(marcador, bytes.subarray(pos + 2, fin))) {
      partes.push(bytes.subarray(inicio, fin))
    }
    pos = fin
    if (marcador === SOS) trasSos = true
  }

  if (!trasSos) throw noValida("JPEG", "falta el inicio del escaneo (SOS)")
  // Sin EOI: tras el último SOS solo hay datos comprimidos, que se conservan.
  return unir(partes)
}

/**
 * Posición del siguiente marcador tras unos datos comprimidos, o el final del
 * archivo. Dentro de ellos, FF 00 es un 0xFF escapado y RSTn forma parte del
 * escaneo; los FF de relleno quedan del lado de los datos.
 */
function finDeDatosComprimidos(bytes: Uint8Array, desde: number): number {
  let pos = desde
  while (pos < bytes.length) {
    if (bytes[pos] !== MARCADOR) {
      pos++
      continue
    }
    let siguiente = pos + 1
    while (bytes[siguiente] === MARCADOR) siguiente++
    const codigo = bytes[siguiente]
    if (codigo === undefined) return bytes.length
    if (codigo !== 0x00 && !esRst(codigo)) return siguiente - 1
    pos = siguiente + 1
  }
  return bytes.length
}

// ---------------------------------------------------------------- PNG

/**
 * Lista blanca: estructura y píxeles (IHDR, PLTE, IDAT, IEND), transparencia y
 * lo que cambia el color o la escala al mostrarla. Se descarta todo lo demás:
 * eXIf, tEXt, zTXt, iTXt (XMP), tIME, caBX (C2PA), privados y desconocidos.
 */
const BLOQUES_PNG_ADMITIDOS = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "bKGD",
  "pHYs",
])
const TIPO_PNG = /^[A-Za-z]{4}$/

function pngSinMetadatos(bytes: Uint8Array): Uint8Array {
  if (!empiezaPor(bytes, FIRMA_PNG)) throw noValida("PNG", "no tiene la firma PNG")
  const vista = vistaDe(bytes)
  const partes: Uint8Array[] = [bytes.subarray(0, FIRMA_PNG.length)]
  let pos: number = FIRMA_PNG.length

  // Cada bloque: longitud (4, big-endian), tipo (4), datos y CRC (4).
  while (pos < bytes.length) {
    if (pos + 12 > bytes.length) throw noValida("PNG", "un bloque se sale del archivo")
    const longitud = vista.getUint32(pos)
    const tipo = ascii(bytes, pos + 4, 4)
    const fin = pos + 12 + longitud
    if (longitud > 0x7fffffff || fin > bytes.length) {
      throw noValida("PNG", "un bloque se sale del archivo")
    }
    if (!TIPO_PNG.test(tipo)) throw noValida("PNG", "hay un tipo de bloque no válido")
    if (pos === FIRMA_PNG.length && tipo !== "IHDR") {
      throw noValida("PNG", "no empieza por la cabecera IHDR")
    }

    // Los bloques conservados no cambian, así que su CRC original sigue valiendo.
    if (BLOQUES_PNG_ADMITIDOS.has(tipo)) partes.push(bytes.subarray(pos, fin))
    pos = fin
    // Lo que venga detrás de IEND no forma parte de la imagen.
    if (tipo === "IEND") return unir(partes)
  }

  throw noValida("PNG", "falta el bloque final IEND")
}

// ---------------------------------------------------------------- WebP

/**
 * Lista blanca: imagen (VP8, VP8L), cabecera extendida, alfa, animación y perfil
 * de color. Se descarta todo lo demás: EXIF, XMP, C2PA y bloques desconocidos.
 */
const BLOQUES_WEBP_ADMITIDOS = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"])
/** Dentro de un fotograma ANMF solo se admiten alfa e imagen. */
const SUBBLOQUES_FOTOGRAMA_ADMITIDOS = new Set(["ALPH", "VP8 ", "VP8L"])
const PRIMEROS_BLOQUES_WEBP = new Set(["VP8 ", "VP8L", "VP8X"])
/** Bits del byte de opciones de VP8X que anuncian EXIF (0x08) y XMP (0x04). */
const SIN_EXIF_NI_XMP = ~(0x08 | 0x04) & 0xff
const LONGITUD_VP8X = 10
/** Posición, tamaño, duración y opciones del fotograma, antes de sus subbloques. */
const CABECERA_ANMF = 16
/** Los bloques empiezan tras «RIFF», el tamaño y «WEBP». */
const INICIO_BLOQUES_WEBP = 12

const esRiffWebp = (bytes: Uint8Array): boolean =>
  ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP"

function webpSinMetadatos(bytes: Uint8Array): Uint8Array {
  if (!esRiffWebp(bytes)) throw noValida("WebP", "no es un contenedor RIFF/WEBP")
  const vista = vistaDe(bytes)
  // Lo que haya tras el contenedor RIFF no forma parte de la imagen.
  const finRiff = 8 + vista.getUint32(4, true)
  if (finRiff > bytes.length) throw noValida("WebP", "el tamaño RIFF supera el del archivo")
  if (finRiff <= INICIO_BLOQUES_WEBP) throw noValida("WebP", "no contiene ningún bloque")

  const bloques = bloquesWebp(bytes, vista, INICIO_BLOQUES_WEBP, finRiff, BLOQUES_WEBP_ADMITIDOS)
  // bloquesWebp ya ha comprobado que ahí empieza un bloque completo.
  if (!PRIMEROS_BLOQUES_WEBP.has(ascii(bytes, INICIO_BLOQUES_WEBP, 4))) {
    throw noValida("WebP", "el primer bloque no es de imagen")
  }
  // El tamaño RIFF se recalcula con lo que queda.
  return bloqueRiff("RIFF", [bytes.subarray(8, INICIO_BLOQUES_WEBP), ...bloques])
}

/**
 * Recorre los bloques RIFF entre `desde` y `hasta` (tipo, longitud little-endian,
 * datos y relleno a par) y devuelve, ya limpios, los que están en `admitidos`.
 */
function bloquesWebp(
  bytes: Uint8Array,
  vista: DataView,
  desde: number,
  hasta: number,
  admitidos: ReadonlySet<string>,
): Uint8Array[] {
  const conservados: Uint8Array[] = []
  let pos = desde
  while (pos < hasta) {
    if (pos + 8 > hasta) throw noValida("WebP", "un bloque se sale de su contenedor")
    const tipo = ascii(bytes, pos, 4)
    const longitud = vista.getUint32(pos + 4, true)
    const fin = pos + 8 + longitud + (longitud % 2)
    if (fin > hasta) throw noValida("WebP", "un bloque se sale de su contenedor")
    if (admitidos.has(tipo)) conservados.push(bloqueWebpLimpio(bytes, vista, tipo, pos, fin))
    pos = fin
  }
  return conservados
}

function bloqueWebpLimpio(
  bytes: Uint8Array,
  vista: DataView,
  tipo: string,
  pos: number,
  fin: number,
): Uint8Array {
  const longitud = vista.getUint32(pos + 4, true)
  const datos = pos + 8
  if (tipo === "VP8X") {
    if (longitud < LONGITUD_VP8X) throw noValida("WebP", "la cabecera VP8X está incompleta")
    const bloque = bytes.slice(pos, fin)
    bloque[8] = (bloque[8] ?? 0) & SIN_EXIF_NI_XMP
    return bloque
  }
  if (tipo === "ANMF") {
    // Un fotograma puede llevar dentro bloques desconocidos: también se filtran.
    if (longitud < CABECERA_ANMF) throw noValida("WebP", "un fotograma está incompleto")
    const subbloques = bloquesWebp(
      bytes,
      vista,
      datos + CABECERA_ANMF,
      datos + longitud,
      SUBBLOQUES_FOTOGRAMA_ADMITIDOS,
    )
    return bloqueRiff("ANMF", [bytes.subarray(datos, datos + CABECERA_ANMF), ...subbloques])
  }
  return bytes.subarray(pos, fin)
}

/** Bloque RIFF nuevo: tipo, longitud little-endian, contenido y relleno a par. */
function bloqueRiff(tipo: string, contenido: readonly Uint8Array[]): Uint8Array {
  const longitud = contenido.reduce((total, parte) => total + parte.length, 0)
  const cabecera = new Uint8Array(8)
  cabecera.set(codigos(tipo))
  vistaDe(cabecera).setUint32(4, longitud, true)
  return unir([cabecera, ...contenido, new Uint8Array(longitud % 2)])
}

// ---------------------------------------------------------------- Utilidades

function noValida(formato: string, motivo: string): Error {
  return new Error(`La imagen no es un ${formato} válido: ${motivo}`)
}

function codigos(texto: string): number[] {
  return Array.from(texto, (caracter) => caracter.charCodeAt(0))
}

function empiezaPor(bytes: Uint8Array, firma: readonly number[]): boolean {
  return bytes.length >= firma.length && firma.every((valor, i) => bytes[i] === valor)
}

function ascii(bytes: Uint8Array, desde: number, cuantos: number): string {
  return String.fromCharCode(...bytes.subarray(desde, desde + cuantos))
}

function vistaDe(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** Siempre en un búfer nuevo: la salida nunca comparte memoria con la entrada. */
function unir(partes: readonly Uint8Array[]): Uint8Array {
  const salida = new Uint8Array(partes.reduce((total, parte) => total + parte.length, 0))
  let pos = 0
  for (const parte of partes) {
    salida.set(parte, pos)
    pos += parte.length
  }
  return salida
}
