import * as SecureStore from "expo-secure-store"
import * as SQLite from "expo-sqlite"
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from "expo-crypto"

import { CopiaLocalSchema, tienePendientes, type CopiaLocal } from "./copia-local"

/*
 * Almacén privado de sesiones descargadas y borradores, en el teléfono.
 *
 * Una fila por cuenta y sesión en SQLite. El contenido va cifrado con AES-GCM
 * y una clave propia de cada cuenta que vive en el llavero del sistema; el dato
 * adicional autenticado es `cuenta:sesión`, así una fila no se puede trasplantar
 * a otra. SecureStore queda solo para la clave: una rutina entera no cabe en
 * una entrada del llavero.
 *
 * Las escrituras van en cola: `guardar` solo resuelve cuando la fila está en
 * disco, que es lo único que permite a la pantalla decir «Guardado».
 */

const OPCIONES_LLAVERO: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

let base: Promise<SQLite.SQLiteDatabase> | null = null
let cola: Promise<unknown> = Promise.resolve()
const claves = new Map<string, Promise<AESEncryptionKey>>()

function abrir(): Promise<SQLite.SQLiteDatabase> {
  base ??= (async () => {
    const db = await SQLite.openDatabaseAsync("entrenamiento.db")
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS copias (
        cuenta TEXT NOT NULL,
        sesion TEXT NOT NULL,
        pendiente INTEGER NOT NULL,
        datos TEXT NOT NULL,
        PRIMARY KEY (cuenta, sesion)
      );
    `)
    return db
  })()
  return base
}

function enCola<T>(trabajo: () => Promise<T>): Promise<T> {
  const siguiente = cola.then(trabajo, trabajo)
  cola = siguiente.catch(() => undefined)
  return siguiente
}

function nombreDeClave(cuenta: string): string {
  return `alpha_omega_clave_borradores_${cuenta.replace(/[^A-Za-z0-9._-]/g, "")}`
}

function claveDe(cuenta: string): Promise<AESEncryptionKey> {
  let clave = claves.get(cuenta)
  if (clave === undefined) {
    clave = (async () => {
      const guardada = await SecureStore.getItemAsync(nombreDeClave(cuenta), OPCIONES_LLAVERO)
      if (guardada !== null) {
        return AESEncryptionKey.import(guardada, "base64")
      }
      const nueva = await AESEncryptionKey.generate(AESKeySize.AES256)
      await SecureStore.setItemAsync(
        nombreDeClave(cuenta),
        await nueva.encoded("base64"),
        OPCIONES_LLAVERO,
      )
      return nueva
    })()
    claves.set(cuenta, clave)
    clave.catch(() => claves.delete(cuenta))
  }
  return clave
}

/*
 * Texto a base64 sin depender de TextEncoder: el JSON se escribe solo con
 * caracteres ASCII (lo demás como \\uXXXX, que sigue siendo JSON válido).
 */
function aBase64(copia: CopiaLocal): string {
  const ascii = JSON.stringify(copia).replace(
    /[\u007f-￿]/g,
    (caracter) => `\\u${caracter.charCodeAt(0).toString(16).padStart(4, "0")}`,
  )
  return btoa(ascii)
}

function datoAdicional(cuenta: string, sesion: string): string {
  return btoa(`${cuenta}:${sesion}`)
}

async function cifrar(cuenta: string, copia: CopiaLocal): Promise<string> {
  const sellado = await aesEncryptAsync(aBase64(copia), await claveDe(cuenta), {
    additionalData: datoAdicional(cuenta, copia.sesionId),
  })
  return sellado.combined("base64")
}

async function descifrar(cuenta: string, sesion: string, datos: string): Promise<CopiaLocal> {
  const claro = await aesDecryptAsync(AESSealedData.fromCombined(datos), await claveDe(cuenta), {
    output: "base64",
    additionalData: datoAdicional(cuenta, sesion),
  })
  return CopiaLocalSchema.parse(JSON.parse(atob(claro)))
}

export async function leerCopia(cuenta: string, sesion: string): Promise<CopiaLocal | null> {
  const db = await abrir()
  const fila = await db.getFirstAsync<{ datos: string }>(
    "SELECT datos FROM copias WHERE cuenta = ? AND sesion = ?",
    [cuenta, sesion],
  )
  // Una fila que no se puede leer lanza: nunca se sustituye en silencio por nada.
  return fila === null ? null : descifrar(cuenta, sesion, fila.datos)
}

export async function guardarCopia(cuenta: string, copia: CopiaLocal): Promise<void> {
  const datos = await cifrar(cuenta, copia)
  await enCola(async () => {
    const db = await abrir()
    await db.runAsync(
      `INSERT INTO copias (cuenta, sesion, pendiente, datos) VALUES (?, ?, ?, ?)
       ON CONFLICT (cuenta, sesion) DO UPDATE SET pendiente = excluded.pendiente, datos = excluded.datos`,
      [cuenta, copia.sesionId, tienePendientes(copia) ? 1 : 0, datos],
    )
  })
}

export async function listarCopias(cuenta: string): Promise<CopiaLocal[]> {
  const db = await abrir()
  const filas = await db.getAllAsync<{ sesion: string; datos: string }>(
    "SELECT sesion, datos FROM copias WHERE cuenta = ?",
    [cuenta],
  )
  const copias: CopiaLocal[] = []
  for (const fila of filas) {
    try {
      copias.push(await descifrar(cuenta, fila.sesion, fila.datos))
    } catch {
      // Una fila ilegible no impide ver las demás; se sigue ofreciendo por id.
    }
  }
  return copias
}

export async function borrarCopia(cuenta: string, sesion: string): Promise<void> {
  await enCola(async () => {
    const db = await abrir()
    await db.runAsync("DELETE FROM copias WHERE cuenta = ? AND sesion = ?", [cuenta, sesion])
  })
}

export async function hayPendientes(cuenta: string): Promise<boolean> {
  const db = await abrir()
  const fila = await db.getFirstAsync<{ total: number }>(
    "SELECT COUNT(*) AS total FROM copias WHERE cuenta = ? AND pendiente = 1",
    [cuenta],
  )
  return (fila?.total ?? 0) > 0
}

/** Al cerrar sesión a propósito: nada de esta cuenta queda en el móvil. */
export async function borrarDatosDeCuenta(cuenta: string): Promise<void> {
  await enCola(async () => {
    const db = await abrir()
    await db.runAsync("DELETE FROM copias WHERE cuenta = ?", [cuenta])
  })
  claves.delete(cuenta)
  await SecureStore.deleteItemAsync(nombreDeClave(cuenta), OPCIONES_LLAVERO)
}
