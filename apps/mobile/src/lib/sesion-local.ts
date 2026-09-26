import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { UsuarioPublicoSchema, type UsuarioPublico } from "@alpha-omega/shared"

/**
 * Identidad mínima de la última cuenta que entró en este dispositivo.
 *
 * Solo sirve para una cosa: que un cliente que abre la app en el sótano del
 * gimnasio, sin cobertura, pueda seguir registrando las sesiones que ya había
 * descargado. No da acceso al servidor ni a nada de otra cuenta. Se borra al
 * cerrar sesión y cuando el servidor rechaza la sesión.
 */
const CLAVE = "alpha_omega_identidad_local"
const esWeb = Platform.OS === "web"
const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function guardarIdentidadLocal(usuario: UsuarioPublico): Promise<void> {
  const valor = JSON.stringify(usuario)
  if (esWeb) {
    globalThis.localStorage?.setItem(CLAVE, valor)
    return
  }
  await SecureStore.setItemAsync(CLAVE, valor, OPCIONES)
}

export async function leerIdentidadLocal(): Promise<UsuarioPublico | null> {
  try {
    const valor = esWeb
      ? (globalThis.localStorage?.getItem(CLAVE) ?? null)
      : await SecureStore.getItemAsync(CLAVE, OPCIONES)
    if (valor === null) {
      return null
    }
    const leido = UsuarioPublicoSchema.safeParse(JSON.parse(valor))
    return leido.success ? leido.data : null
  } catch {
    return null
  }
}

export async function borrarIdentidadLocal(): Promise<void> {
  try {
    if (esWeb) {
      globalThis.localStorage?.removeItem(CLAVE)
      return
    }
    await SecureStore.deleteItemAsync(CLAVE, OPCIONES)
  } catch {
    // Igual que el token: un llavero roto no puede impedir cerrar sesión.
  }
}
