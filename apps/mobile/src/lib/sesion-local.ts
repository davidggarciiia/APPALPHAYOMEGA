import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { digestStringAsync, CryptoDigestAlgorithm } from "expo-crypto"
import { z } from "zod"
import type { UsuarioPublico } from "@alpha-omega/shared"

const IdentidadLocalSchema = z.strictObject({
  id: z.uuid(),
  nombre: z.string().max(80),
  rol: z.literal("cliente"),
})
const SobreSchema = z.strictObject({ usuario: IdentidadLocalSchema, huella: z.string() })
export type IdentidadLocal = z.infer<typeof IdentidadLocalSchema>
const CLAVE = "ao.identidad.local"
const OPCIONES = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const LIMPIEZA = "ao.limpieza.pendiente"
const LimpiezaSchema = z.strictObject({ cuenta: z.uuid().nullable() })

export async function marcarLimpieza(cuenta: string | null): Promise<void> {
  const valor = JSON.stringify({ cuenta })
  if (Platform.OS === "web") localStorage.setItem(LIMPIEZA, valor)
  else await SecureStore.setItemAsync(LIMPIEZA, valor, OPCIONES)
}
export async function leerLimpieza(): Promise<z.infer<typeof LimpiezaSchema> | null> {
  const valor =
    Platform.OS === "web"
      ? localStorage.getItem(LIMPIEZA)
      : await SecureStore.getItemAsync(LIMPIEZA, OPCIONES)
  return valor === null ? null : LimpiezaSchema.parse(JSON.parse(valor))
}
export async function terminarLimpieza(): Promise<void> {
  if (Platform.OS === "web") localStorage.removeItem(LIMPIEZA)
  else await SecureStore.deleteItemAsync(LIMPIEZA, OPCIONES)
}

export async function guardarIdentidadLocal(usuario: UsuarioPublico, token: string): Promise<void> {
  if (usuario.rol !== "cliente") return borrarIdentidadLocal()
  const valor = JSON.stringify({
    usuario: IdentidadLocalSchema.parse({
      id: usuario.id,
      nombre: usuario.nombre,
      rol: usuario.rol,
    }),
    huella: await digestStringAsync(CryptoDigestAlgorithm.SHA256, token),
  })
  if (Platform.OS === "web") localStorage.setItem(CLAVE, valor)
  else await SecureStore.setItemAsync(CLAVE, valor, OPCIONES)
}
async function leerSobre(): Promise<z.infer<typeof SobreSchema> | null> {
  const valor =
    Platform.OS === "web"
      ? localStorage.getItem(CLAVE)
      : await SecureStore.getItemAsync(CLAVE, OPCIONES)
  if (valor === null) return null
  return SobreSchema.parse(JSON.parse(valor))
}
export async function leerCuentaLocal(): Promise<string | null> {
  return (await leerSobre())?.usuario.id ?? null
}
export async function leerIdentidadLocal(token: string): Promise<IdentidadLocal | null> {
  const sobre = await leerSobre()
  if (!sobre || sobre.huella !== (await digestStringAsync(CryptoDigestAlgorithm.SHA256, token)))
    return null
  return sobre.usuario
}
export async function borrarIdentidadLocal(): Promise<void> {
  if (Platform.OS === "web") localStorage.removeItem(CLAVE)
  else await SecureStore.deleteItemAsync(CLAVE, OPCIONES)
}
