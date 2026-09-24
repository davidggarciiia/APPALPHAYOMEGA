import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

import { leerVariableOpcional } from "../config/entorno.js"

import { MEDIOS, type MedioDelIndice } from "./medios.js"

/**
 * Dónde viven los archivos de las figuras. Carpeta privada del servidor, fuera
 * del repositorio y de cualquier ruta pública: solo se sirven por la API, tras
 * comprobar el rol. Con almacenamiento de objetos (ADR 0005) este es el único
 * archivo que cambia.
 */
export function carpetaDeMedios(): string | null {
  const configurada = leerVariableOpcional("MEDIOS_DIR", "")
  return configurada === "" ? null : resolve(configurada)
}

export function rutaDelVideo(carpeta: string, medio: MedioDelIndice): string {
  return join(carpeta, "figuras", `${medio.id}.mp4`)
}

export function rutaDelPoster(carpeta: string, medio: MedioDelIndice): string {
  return join(carpeta, "figuras", `${medio.id}.jpg`)
}

/** Medios del índice cuyo vídeo está importado en este servidor. */
export function mediosDisponibles(): MedioDelIndice[] {
  const carpeta = carpetaDeMedios()
  if (carpeta === null) return []
  return MEDIOS.filter((medio) => existsSync(rutaDelVideo(carpeta, medio)))
}
