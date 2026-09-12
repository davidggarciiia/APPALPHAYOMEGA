import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

/**
 * Guarda el token de refresco.
 *
 * En iOS y Android va al llavero del sistema: cifrado por el sistema operativo,
 * fuera del alcance de otras apps y de una copia de seguridad sin cifrar. Es
 * donde SPEC-identity.md exige que viva (requisito 11).
 *
 * En web no existe ese llavero y `expo-secure-store` no funciona. Se cae a
 * `localStorage`, que es MENOS SEGURO: cualquier script que se cuele en la
 * pagina puede leerlo. Se acepta porque la web solo se usa para desarrollo; el
 * producto que se publica es la app nativa. Si algun dia hubiera un cliente web
 * de verdad, esto deja de ser aceptable y habria que pasar a cookies de sesion
 * marcadas httpOnly.
 */

const CLAVE_REFRESCO = "alpha_omega_token_refresco"

const esWeb = Platform.OS === "web"

export async function guardarTokenRefresco(token: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.setItem(CLAVE_REFRESCO, token)
    return
  }
  await SecureStore.setItemAsync(CLAVE_REFRESCO, token)
}

export async function leerTokenRefresco(): Promise<string | null> {
  if (esWeb) {
    return globalThis.localStorage?.getItem(CLAVE_REFRESCO) ?? null
  }
  return SecureStore.getItemAsync(CLAVE_REFRESCO)
}

export async function borrarTokenRefresco(): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.removeItem(CLAVE_REFRESCO)
    return
  }
  await SecureStore.deleteItemAsync(CLAVE_REFRESCO)
}
