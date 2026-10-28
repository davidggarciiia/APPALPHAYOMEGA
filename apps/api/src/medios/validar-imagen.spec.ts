import sharp from "sharp"
import { jpegSintetico } from "../../test/imagenes-ayuda.js"
import { sinMetadatos, type FormatoImagen } from "./imagenes.js"
import { validarImagen } from "./validar-imagen.js"

const patron = Buffer.from(Array.from({ length: 16 * 16 * 3 }, (_, i) => (i * 17) % 256))
const imagen = () => sharp(patron, { raw: { width: 16, height: 16, channels: 3 } })

it.each(["jpeg", "png", "webp"] as const)(
  "decodifica %s real sin modificar sus bytes ni píxeles",
  async (formato) => {
    const original = await imagen().toFormat(formato).toBuffer()
    const limpio = sinMetadatos(original, `image/${formato}` as FormatoImagen)
    const copia = Buffer.from(limpio)
    await expect(validarImagen(limpio)).resolves.toBeUndefined()
    expect(Buffer.from(limpio)).toEqual(copia)
    expect(await sharp(limpio).raw().toBuffer()).toEqual(await sharp(original).raw().toBuffer())
  },
)

it("rechaza un JPEG truncado aunque queden cabecera y escaneo", async () => {
  const jpeg = await imagen().jpeg().toBuffer()
  const truncado = jpeg.subarray(0, jpeg.length - 20)
  const limpio = sinMetadatos(truncado, "image/jpeg")
  await expect(validarImagen(limpio)).rejects.toThrow()
})

it("rechaza un WebP truncado aunque se ajusten las longitudes del contenedor", async () => {
  const webp = await imagen().webp().toBuffer()
  expect(webp.toString("ascii", 12, 16)).toBe("VP8 ")
  const truncado = Buffer.from(webp.subarray(0, webp.length - 10))
  truncado.writeUInt32LE(truncado.length - 8, 4)
  truncado.writeUInt32LE(truncado.length - 20, 16)
  const limpio = sinMetadatos(truncado, "image/webp")
  await expect(validarImagen(limpio)).rejects.toThrow()
})

it("conserva WebP animado válido y rechaza un segundo fotograma dañado", async () => {
  const animado = await sharp(Buffer.concat([patron, Buffer.from(patron).reverse()]), {
    raw: { width: 16, height: 32, channels: 3, pageHeight: 16 },
  })
    .webp({ delay: [100, 100] })
    .toBuffer()
  expect((await sharp(animado, { animated: true }).metadata()).pages).toBe(2)
  await expect(validarImagen(sinMetadatos(animado, "image/webp"))).resolves.toBeUndefined()
  const danado = Buffer.from(animado)
  const primero = danado.indexOf("ANMF")
  const segundo = danado.indexOf("ANMF", primero + 4)
  const vp8 = danado.indexOf("VP8 ", segundo + 24)
  expect(segundo).toBeGreaterThan(primero)
  expect(vp8).toBeGreaterThan(segundo)
  danado.fill(0, vp8 + 8, vp8 + 16)
  await expect(validarImagen(sinMetadatos(danado, "image/webp"))).rejects.toThrow()
})

it("rechaza dimensiones superiores a 40 millones de píxeles sin crear ese mapa de memoria", async () => {
  const jpeg = await imagen().jpeg().toBuffer()
  const sof = jpeg.indexOf(Buffer.from([0xff, 0xc0]))
  expect(sof).toBeGreaterThan(0)
  jpeg.writeUInt16BE(8000, sof + 5)
  jpeg.writeUInt16BE(8000, sof + 7)
  await expect(validarImagen(jpeg)).rejects.toThrow(/pixel limit/i)
})

it("los fixtures de fotos con metadatos ficticios son JPEG decodificables tras limpiarlos", async () => {
  for (const variante of [false, true]) {
    const jpeg = jpegSintetico(variante)
    expect(jpeg.toString("latin1")).toContain("GPS")
    const limpio = sinMetadatos(jpeg, "image/jpeg")
    expect(Buffer.from(limpio).toString("latin1")).not.toContain("GPS")
    await expect(validarImagen(limpio)).resolves.toBeUndefined()
  }
})
