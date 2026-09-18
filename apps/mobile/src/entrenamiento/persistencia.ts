import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite"
import type { PersistenciaCifrada } from "./almacen-local"

let apertura: Promise<SQLiteDatabase> | null = null
function abrir(): Promise<SQLiteDatabase> {
  apertura ??= (async () => {
    const db = await openDatabaseAsync("entrenamiento-cifrado.db")
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS documentos (cuenta TEXT NOT NULL, clave TEXT NOT NULL, valor TEXT NOT NULL, PRIMARY KEY (cuenta, clave))",
    )
    return db
  })().catch((error) => {
    apertura = null
    throw error
  })
  return apertura
}
export const persistencia: PersistenciaCifrada = {
  leer: async (cuenta, clave) =>
    (
      await (
        await abrir()
      ).getFirstAsync<{ valor: string }>(
        "SELECT valor FROM documentos WHERE cuenta = ? AND clave = ?",
        cuenta,
        clave,
      )
    )?.valor ?? null,
  escribir: async (cuenta, clave, valor) => {
    await (
      await abrir()
    ).runAsync(
      "INSERT INTO documentos (cuenta, clave, valor) VALUES (?, ?, ?) ON CONFLICT(cuenta, clave) DO UPDATE SET valor = excluded.valor",
      cuenta,
      clave,
      valor,
    )
  },
  borrar: async (cuenta, clave) => {
    await (
      await abrir()
    ).runAsync("DELETE FROM documentos WHERE cuenta = ? AND clave = ?", cuenta, clave)
  },
  listar: async (cuenta) =>
    (
      await (
        await abrir()
      ).getAllAsync<{ clave: string }>("SELECT clave FROM documentos WHERE cuenta = ?", cuenta)
    ).map((fila) => fila.clave),
  limpiar: async (cuenta) => {
    await (await abrir()).runAsync("DELETE FROM documentos WHERE cuenta = ?", cuenta)
  },
}
