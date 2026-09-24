/**
 * Imagen JPEG SINTÉTICA mínima: cabecera JFIF, un APP1 «Exif» con un texto GPS
 * inventado, un comentario, la exploración y el final. No es una foto de nadie.
 */
export function jpegSintetico(): Buffer {
  const segmento = (marcador: number, datos: Buffer) => {
    const longitud = Buffer.alloc(2)
    longitud.writeUInt16BE(datos.length + 2)
    return Buffer.concat([Buffer.from([0xff, marcador]), longitud, datos])
  }
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segmento(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1")),
    segmento(0xe1, Buffer.from("Exif\0\0GPS 41.3874N 2.1686E sintetico", "latin1")),
    segmento(0xfe, Buffer.from("comentario sintetico", "latin1")),
    segmento(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00])),
    Buffer.from([0x12, 0x34, 0x56, 0x78]),
    Buffer.from([0xff, 0xd9]),
  ])
}

/** Ruta relativa (con su consulta firmada) de un enlace del almacén local. */
export function rutaDeEnlace(url: string): string {
  const enlace = new URL(url)
  return `${enlace.pathname}${enlace.search}`
}
