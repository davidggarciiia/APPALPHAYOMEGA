import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { cargarEntornoLocal } from "../config/entorno.js"

import { carpetaDeMedios, rutaDelPoster, rutaDelVideo } from "./almacen-medios.js"
import { MEDIOS } from "./medios.js"

/**
 * Importa las figuras gratuitas desde los paquetes descargados a MEDIOS_DIR.
 *
 *   npm run build --workspace apps/api
 *   node apps/api/dist/catalogo-ejercicios/importar-medios.js \
 *     --vital <carpeta con 0051.mp4…0100.mp4> --movekit <carpeta con pull-ups.mp4>
 *
 * Necesita ffmpeg. Cada clip se pasa a 720 px, H.264 con `faststart` y sin
 * audio (los de Vital traen pista de audio): pesan entre 140 y 370 KB. Genera
 * además un póster JPG. La licencia de los dos proveedores permite adaptarlos.
 */
function argumento(nombre: string): string | null {
  const indice = process.argv.indexOf(`--${nombre}`)
  return indice === -1 ? null : (process.argv[indice + 1] ?? null)
}

cargarEntornoLocal()
const destino = carpetaDeMedios()
if (destino === null) {
  console.error("Falta MEDIOS_DIR en el entorno: la carpeta privada donde vivirán las figuras.")
  process.exit(1)
}
const origenes = { vital: argumento("vital"), movekit: argumento("movekit") }
const forzar = process.argv.includes("--forzar")
let importados = 0
for (const medio of MEDIOS) {
  const carpeta = origenes[medio.fuente]
  if (carpeta === null) continue
  const origen = join(carpeta, medio.archivoOrigen)
  if (!existsSync(origen)) {
    console.warn(`No está ${medio.archivoOrigen} en ${carpeta}; se omite ${medio.id}.`)
    continue
  }
  const video = rutaDelVideo(destino, medio)
  if (existsSync(video) && !forzar) continue
  mkdirSync(dirname(video), { recursive: true })
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      origen,
      "-vf",
      "scale='min(720,iw)':-2",
      "-c:v",
      "libx264",
      "-profile:v",
      "main",
      "-crf",
      "26",
      "-preset",
      "slow",
      "-movflags",
      "+faststart",
      "-an",
      video,
    ],
    { stdio: "inherit" },
  )
  execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-ss",
      "1",
      "-i",
      origen,
      "-frames:v",
      "1",
      "-vf",
      "scale=480:-2",
      "-q:v",
      "4",
      rutaDelPoster(destino, medio),
    ],
    { stdio: "inherit" },
  )
  importados++
}
console.log(`Figuras importadas: ${String(importados)} en ${destino}`)
