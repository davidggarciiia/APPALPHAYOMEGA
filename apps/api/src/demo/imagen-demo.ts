import { deflateSync } from "node:zlib"

/**
 * Fotos de progreso inventadas para los datos de demostración: una silueta sobre
 * fondo de estudio, más ancha o más estrecha según `volumen` (0 = definida,
 * 1 = con más grasa), de frente o de perfil. Nunca fotos de personas reales.
 *
 * PNG sin dependencias: filas sin filtro, comprimidas con zlib. La figura se
 * dibuja con distancias con signo a elipses y cápsulas unidas suavemente.
 */

type Color = readonly [number, number, number]

const ANCHO = 480
const ALTO = 640

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  return tabla
})()

function crc32(datos: Buffer): number {
  let c = 0xffffffff
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

function png(ancho: number, alto: number, pixel: (x: number, y: number) => Color): Buffer {
  const filas = Buffer.alloc((ancho * 3 + 1) * alto)
  let i = 0
  for (let y = 0; y < alto; y++) {
    filas[i++] = 0
    for (let x = 0; x < ancho; x++) {
      const [r, g, b] = pixel(x, y)
      filas[i++] = r
      filas[i++] = g
      filas[i++] = b
    }
  }
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(ancho, 0)
  cabecera.writeUInt32BE(alto, 4)
  cabecera[8] = 8
  cabecera[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque("IHDR", cabecera),
    bloque("IDAT", deflateSync(filas, { level: 9 })),
    bloque("IEND", Buffer.alloc(0)),
  ])
}

const mezclar = (a: Color, b: Color, t: number): Color => {
  const k = Math.max(0, Math.min(1, t))
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ]
}

type Punto = readonly [number, number]

/** Distancia aproximada con signo a una elipse: < 0 dentro. */
function elipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  const dx = (x - cx) / rx
  const dy = (y - cy) / ry
  return (Math.hypot(dx, dy) - 1) * Math.min(rx, ry)
}

/** Cápsula cónica de `a` (radio ra) a `b` (radio rb): < 0 dentro. */
function capsula(x: number, y: number, a: Punto, b: Punto, ra: number, rb: number): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t)) - (ra + (rb - ra) * t)
}

/** Extremidad de dos tramos (hombro-codo-muñeca o cadera-rodilla-tobillo). */
function extremidad(
  x: number,
  y: number,
  p: readonly [Punto, Punto, Punto],
  r: readonly [number, number, number],
): number {
  return Math.min(capsula(x, y, p[0], p[1], r[0], r[1]), capsula(x, y, p[1], p[2], r[1], r[2]))
}

/** Unión suave: las piezas se funden en lugar de encajar con esquinas. */
function unir(k: number, ...distancias: number[]): number {
  return distancias.reduce((a, b) => {
    const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k))
    return b + (a - b) * h - k * h * (1 - h)
  })
}

const PIEL: Color = [214, 172, 142]
const PIEL_SOMBRA: Color = [128, 88, 66]
const PANTALON: Color = [38, 38, 44]
const PANTALON_SOMBRA: Color = [16, 16, 19]

export function silueta(vista: "frente" | "perfil", volumen: number): Buffer {
  const cx = ANCHO / 2
  const v = Math.max(0, Math.min(1, volumen))

  const frente = (x: number, y: number): { d: number; ropa: boolean } => {
    const cabeza = elipse(x, y, cx, 98, 29, 37)
    const cuello = capsula(x, y, [cx, 125], [cx, 165], 15, 17)
    const pecho = elipse(x, y, cx, 208, 84 + v * 8, 58)
    const abdomen = elipse(x, y, cx, 292, 56 + v * 44, 74)
    const pelvis = elipse(x, y, cx, 362, 68 + v * 22, 46)
    const brazos = Math.min(
      ...[-1, 1].map((s) =>
        extremidad(
          x,
          y,
          [
            [cx + s * (82 + v * 8), 184],
            [cx + s * (100 + v * 22), 288],
            [cx + s * (106 + v * 26), 382],
          ],
          [21 + v * 5, 16 + v * 5, 12 + v * 2],
        ),
      ),
    )
    const piernas = Math.min(
      ...[-1, 1].map((s) =>
        extremidad(
          x,
          y,
          [
            [cx + s * (34 + v * 10), 372],
            [cx + s * (38 + v * 10), 486],
            [cx + s * 36, 590],
          ],
          [33 + v * 11, 23 + v * 5, 16],
        ),
      ),
    )
    const tronco = unir(22, cuello, pecho, abdomen, pelvis)
    const d = unir(10, cabeza, unir(14, tronco, brazos), unir(18, tronco, piernas))
    return { d, ropa: y > 338 && y < 440 && brazos > 0 }
  }

  const perfil = (x: number, y: number): { d: number; ropa: boolean } => {
    const cabeza = elipse(x, y, cx + 6, 98, 31, 37)
    const nariz = elipse(x, y, cx + 36, 102, 7, 9)
    const cuello = capsula(x, y, [cx + 2, 125], [cx, 168], 14, 16)
    const pecho = elipse(x, y, cx + 4, 212, 40 + v * 8, 60)
    const abdomen = elipse(x, y, cx + 6 + v * 24, 294, 34 + v * 30, 64)
    const gluteo = elipse(x, y, cx - 6 - v * 4, 356, 40 + v * 10, 46)
    const brazo = extremidad(
      x,
      y,
      [
        [cx - 2, 186],
        [cx + 4, 290],
        [cx + 12, 378],
      ],
      [18 + v * 5, 15 + v * 4, 11],
    )
    const pierna = extremidad(
      x,
      y,
      [
        [cx - 2, 374],
        [cx + 6, 486],
        [cx, 590],
      ],
      [34 + v * 10, 23 + v * 4, 16],
    )
    const tronco = unir(22, cuello, pecho, abdomen, gluteo, pierna)
    const d = unir(10, unir(4, cabeza, nariz), tronco)
    // El brazo va delante del cuerpo: se sombrea con su propia distancia, así su
    // borde se oscurece y se distingue del tronco que tapa.
    return brazo < 0 ? { d: brazo, ropa: false } : { d, ropa: y > 338 && y < 440 }
  }

  const figura = vista === "frente" ? frente : perfil

  return png(ANCHO, ALTO, (x, y) => {
    // Fondo de estudio: degradado vertical, halo detrás de la figura y suelo.
    const halo = Math.max(0, 1 - Math.hypot(x - cx, y - 300) / 360) * 0.35
    const fondo = mezclar(mezclar([60, 58, 64], [24, 23, 26], y / ALTO), [84, 80, 88], halo)
    const suelo = y > 596 ? mezclar(fondo, [16, 16, 18], (y - 596) / 30) : fondo

    const { d, ropa } = figura(x, y)
    if (d > 1.5) {
      // Sombra de contacto en el suelo.
      const sombra =
        y > 580 && y < 604 ? Math.max(0, 1 - Math.hypot((x - cx) / 90, (y - 594) / 10)) : 0
      return mezclar(suelo, [10, 10, 12], sombra * 0.7)
    }
    // Volumen: más oscuro hacia el borde y con la luz entrando por la izquierda.
    const profundidad = Math.sqrt(Math.min(1, -d / 38))
    const lateral = Math.max(0, Math.min(1, (x - cx + 60) / 260))
    const [claro, oscuro] = ropa ? [PANTALON, PANTALON_SOMBRA] : [PIEL, PIEL_SOMBRA]
    const color = mezclar(oscuro, claro, profundidad * (1 - lateral * 0.45))
    // Antialias del contorno.
    return d > -1.5 ? mezclar(color, suelo, (d + 1.5) / 3) : color
  })
}
