import sharp from "sharp"

/** Decodifica todos los píxeles y descarta la salida; se guarda el original limpio. */
export async function validarImagen(bytes: Uint8Array): Promise<void> {
  await sharp(bytes, {
    failOn: "warning",
    limitInputPixels: 40_000_000,
    animated: true,
  })
    .raw()
    .timeout({ seconds: 10 })
    .toBuffer()
}
