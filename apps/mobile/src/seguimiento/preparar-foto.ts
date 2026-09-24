import { Platform } from "react-native"
import * as ImagePicker from "expo-image-picker"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { BYTES_MAXIMOS_FOTO } from "@alpha-omega/shared"

/**
 * Elegir y preparar una foto de evolución antes de subirla (F03a, ADR 0005).
 *
 * La foto se vuelve a codificar como JPEG desde los píxeles: el archivo nuevo
 * no lleva EXIF, ubicación ni otros metadatos del original (el servidor además
 * los retira al confirmar). La orientación la aplica el propio manipulador al
 * cargar la imagen (iOS la endereza, en Android Glide aplica la orientación
 * EXIF y en web lo hace el navegador), así que aquí no se gira otra vez.
 *
 * Nada de esto se guarda: la URI local solo vive en memoria mientras dura la
 * subida.
 */

export type OrigenFoto = "camara" | "galeria"

/** Suficiente para ver una evolución corporal y muy por debajo del máximo. */
export const LADO_MAXIMO_FOTO = 1600
export const CALIDAD_JPEG = 0.8

export type FotoPreparada = {
  uri: string
  tipoMime: "image/jpeg"
  bytes: number
  ancho: number
  alto: number
}

export type EleccionFoto =
  | { tipo: "elegida"; uri: string }
  | { tipo: "cancelada" }
  | { tipo: "sinPermiso"; mensaje: string }
  | { tipo: "fallo"; mensaje: string }

export type ObtencionFoto =
  { tipo: "lista"; foto: FotoPreparada } | Exclude<EleccionFoto, { tipo: "elegida" }>

/** Un motivo que se puede enseñar tal cual a quien elige la foto. */
export class ErrorDeFoto extends Error {
  override name = "ErrorDeFoto"
}

const NO_SE_LEE = "No se ha podido leer esta imagen. Elige otra foto o hazla con la cámara."
const MEGAS_MAXIMOS = Math.round(BYTES_MAXIMOS_FOTO / (1024 * 1024))

const OPCIONES: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: false,
  allowsMultipleSelection: false,
  // Sin EXIF ni base64: la ubicación no llega ni a la memoria de la app.
  exif: false,
  base64: false,
  // Sin compresión previa: se reduce una sola vez al preparar.
  quality: 1,
}

/**
 * Abre la cámara o la galería. Cancelar, denegar el permiso o un fallo del
 * selector devuelven un resultado explícito; nunca lanza.
 *
 * La cámara exige su permiso. La galería usa el selector del sistema, que solo
 * entrega la foto elegida: no hace falta pedir acceso a toda la fototeca.
 */
export async function elegirFoto(origen: OrigenFoto): Promise<EleccionFoto> {
  const nombre = origen === "camara" ? "la cámara" : "la galería"
  let resultado: ImagePicker.ImagePickerResult
  try {
    if (origen === "camara") {
      const permiso = await ImagePicker.requestCameraPermissionsAsync()
      if (!permiso.granted) {
        return {
          tipo: "sinPermiso",
          mensaje: permiso.canAskAgain
            ? "Sin permiso para usar la cámara. Vuelve a intentarlo y acéptalo, o elige una foto de la galería."
            : "La cámara está bloqueada para esta app. Actívala en los ajustes del móvil o elige una foto de la galería.",
        }
      }
      resultado = await ImagePicker.launchCameraAsync(OPCIONES)
    } else {
      resultado = await ImagePicker.launchImageLibraryAsync(OPCIONES)
    }
  } catch {
    return { tipo: "fallo", mensaje: `No se ha podido abrir ${nombre}.` }
  }
  const asset = resultado.canceled ? undefined : resultado.assets[0]
  if (!asset) return { tipo: "cancelada" }
  if (asset.type === "video" || asset.type === "pairedVideo") {
    liberarFoto(asset.uri)
    return { tipo: "fallo", mensaje: "Elige una foto, no un vídeo." }
  }
  return { tipo: "elegida", uri: asset.uri }
}

type Liberable = { release: () => void }

/**
 * Endereza, reduce el lado largo a `LADO_MAXIMO_FOTO` (sin ampliar) y vuelve a
 * codificar como JPEG. Los bytes son los reales del archivo resultante.
 * Rechaza con `ErrorDeFoto` si no se puede leer o no cabe en el máximo.
 */
export async function prepararFoto(uri: string): Promise<FotoPreparada> {
  const liberables: Liberable[] = []
  let guardada: { uri: string; width: number; height: number }
  try {
    const contexto = ImageManipulator.manipulate(uri)
    liberables.push(contexto)
    let imagen = await contexto.renderAsync()
    liberables.push(imagen)
    if (Math.max(imagen.width, imagen.height) > LADO_MAXIMO_FOTO) {
      contexto.resize(
        imagen.width >= imagen.height ? { width: LADO_MAXIMO_FOTO } : { height: LADO_MAXIMO_FOTO },
      )
      imagen = await contexto.renderAsync()
      liberables.push(imagen)
    }
    guardada = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG })
  } catch {
    throw new ErrorDeFoto(NO_SE_LEE)
  } finally {
    // Memoria nativa de los mapas de bits: no esperar al recolector.
    for (const objeto of liberables) objeto.release()
  }

  try {
    const bytes = await comprobarJpeg(guardada.uri)
    return {
      uri: guardada.uri,
      tipoMime: "image/jpeg",
      bytes,
      ancho: guardada.width,
      alto: guardada.height,
    }
  } catch (error) {
    liberarFoto(guardada.uri)
    throw error
  }
}

/** Mide el archivo y comprueba que empieza como un JPEG de verdad. */
async function comprobarJpeg(uri: string): Promise<number> {
  let blob: Blob
  try {
    blob = await (await fetch(uri)).blob()
  } catch {
    throw new ErrorDeFoto(NO_SE_LEE)
  }
  try {
    if (blob.size === 0) throw new ErrorDeFoto(NO_SE_LEE)
    const inicio = await primerosBytes(blob, 3)
    if (inicio[0] !== 0xff || inicio[1] !== 0xd8 || inicio[2] !== 0xff)
      throw new ErrorDeFoto("No se ha podido convertir la foto a JPEG. Elige otra foto.")
    if (blob.size > BYTES_MAXIMOS_FOTO)
      throw new ErrorDeFoto(
        `La foto ocupa demasiado (máximo ${MEGAS_MAXIMOS} MB). Elige otra foto.`,
      )
    return blob.size
  } catch (error) {
    throw error instanceof ErrorDeFoto ? error : new ErrorDeFoto(NO_SE_LEE)
  } finally {
    // En React Native el blob ocupa memoria nativa hasta que se cierra.
    ;(blob as Blob & { close?: () => void }).close?.()
  }
}

/** El `Blob` de React Native no tiene `arrayBuffer`; su `FileReader` sí lee bytes. */
async function primerosBytes(blob: Blob, cuantos: number): Promise<Uint8Array> {
  const trozo = blob.slice(0, cuantos)
  if (typeof trozo.arrayBuffer === "function") return new Uint8Array(await trozo.arrayBuffer())
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onload = () => {
      if (lector.result instanceof ArrayBuffer) resolver(new Uint8Array(lector.result))
      else rechazar(new ErrorDeFoto(NO_SE_LEE))
    }
    lector.onerror = () => rechazar(new ErrorDeFoto(NO_SE_LEE))
    lector.readAsArrayBuffer(trozo)
  })
}

/**
 * Suelta la copia temporal de una foto. En web revoca la URL `blob:` y el
 * navegador libera la memoria. En iOS y Android el archivo queda en la caché de
 * la app (el sistema la vacía): borrarlo exige `expo-file-system`, que no es
 * dependencia directa de la app. La URI nunca se guarda en ningún almacén.
 */
export function liberarFoto(uri: string): void {
  if (Platform.OS === "web" && uri.startsWith("blob:")) URL.revokeObjectURL(uri)
}

/** Elegir y preparar en un paso; el original se suelta en cuanto hay copia preparada. */
export async function obtenerFoto(origen: OrigenFoto): Promise<ObtencionFoto> {
  const eleccion = await elegirFoto(origen)
  if (eleccion.tipo !== "elegida") return eleccion
  try {
    return { tipo: "lista", foto: await prepararFoto(eleccion.uri) }
  } catch (error) {
    return { tipo: "fallo", mensaje: error instanceof ErrorDeFoto ? error.message : NO_SE_LEE }
  } finally {
    liberarFoto(eleccion.uri)
  }
}
