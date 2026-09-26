import type { MedioFoto, SolicitarSubida } from "@alpha-omega/shared"

import type { ApiMedios } from "./medios-api"
import { liberarFoto, type FotoPreparada } from "./preparar-foto"

/** Lo que pide la intención de subida; el formato y el tamaño los da la copia preparada. */
export type DatosDeEnvio = Omit<SolicitarSubida, "tipoMime" | "bytes">

/**
 * Envía una foto ya preparada (ADR 0005): pide la intención, sube la copia
 * directamente al almacén con el enlace temporal y la confirma. Solo la
 * confirmación del servidor la da por recibida. Repetir con los mismos datos y
 * la misma operación no crea otra foto: el servidor devuelve la misma y, si ya
 * estaba confirmada, no hay nada que subir.
 *
 * `alConfirmar` avisa cuando el archivo ya está en el almacén y falta la
 * confirmación. No suelta la copia local: eso lo decide quien la conserva
 * para reintentar.
 */
export async function enviarFoto(
  api: Pick<ApiMedios, "solicitarSubida" | "confirmar">,
  datos: DatosDeEnvio,
  foto: FotoPreparada,
  alConfirmar?: () => void,
): Promise<MedioFoto> {
  const intencion = await api.solicitarSubida({
    ...datos,
    tipoMime: foto.tipoMime,
    bytes: foto.bytes,
  })
  if (intencion.subida) {
    const archivo = await (await fetch(foto.uri)).blob()
    try {
      const subida = await fetch(intencion.subida.url, {
        method: intencion.subida.metodo,
        headers: intencion.subida.cabeceras,
        body: archivo,
      })
      if (!subida.ok) throw new Error("No se pudo subir el archivo")
    } finally {
      // En React Native el blob ocupa memoria nativa hasta que se cierra.
      ;(archivo as Blob & { close?: () => void }).close?.()
    }
  }
  alConfirmar?.()
  return api.confirmar(intencion.medio.id)
}

/**
 * Suelta la copia local de una foto. Si el móvil no deja borrarla, queda
 * anotada para volver a intentarlo al salir de la pantalla.
 */
export function soltarCopia(uri: string, porLiberar: Set<string>): void {
  if (liberarFoto(uri) === "fallo") porLiberar.add(uri)
  else porLiberar.delete(uri)
}
