import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"

/**
 * Guarda el token de refresco.
 *
 * En iOS y Android va al llavero del sistema, cifrado por el sistema operativo y
 * fuera del alcance de otras apps. Es donde SPEC-identity.md exige que viva
 * (requisito 11).
 *
 * Se pide explicitamente que la entrada **no salga del dispositivo**. Sin esa
 * opcion, en iOS el llavero entra en las copias de seguridad: restaurar esa copia
 * en otro telefono abriria la app ya dentro de la cuenta, sin pedir contrasena y
 * con acceso a los datos de salud de todos los clientes. Y el nutricionista es
 * personal externo cuyo telefono no controla nadie.
 *
 * En web no existe ese llavero y `expo-secure-store` no funciona. Se cae a
 * `localStorage`, que es MENOS SEGURO: cualquier script que se cuele en la
 * pagina puede leerlo. Se acepta porque la web solo se usa para desarrollo.
 */

const CLAVE_REFRESCO = "alpha_omega_token_refresco"

const esWeb = Platform.OS === "web"

/**
 * La consulta al llavero tiene que llevar las mismas opciones que la escritura,
 * o en iOS no encuentra lo que ella misma guardo.
 */
const OPCIONES: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export async function guardarTokenRefresco(token: string): Promise<void> {
  if (esWeb) {
    globalThis.localStorage?.setItem(CLAVE_REFRESCO, token)
    return
  }
  await SecureStore.setItemAsync(CLAVE_REFRESCO, token, OPCIONES)
}

/**
 * Lee el token guardado.
 *
 * Devuelve null tambien cuando el llavero falla, no solo cuando esta vacio. En
 * Android el almacen de claves puede quedar inconsistente tras cambiar el PIN o
 * actualizar el sistema, y en iOS leer con el dispositivo bloqueado lanza. Si
 * esos casos se propagaran, la app se quedaria colgada en la pantalla de carga
 * sin salida posible: reabrirla repetiria el mismo fallo.
 *
 * Ante un llavero roto se borra la entrada y se trata como "no hay sesion". El
 * usuario escribe su contrasena una vez, que es molesto pero recuperable.
 */
export async function leerTokenRefresco(): Promise<string | null> {
  if (esWeb) {
    try {
      return globalThis.localStorage?.getItem(CLAVE_REFRESCO) ?? null
    } catch {
      return null
    }
  }

  try {
    return await SecureStore.getItemAsync(CLAVE_REFRESCO, OPCIONES)
  } catch {
    await borrarTokenRefresco()
    return null
  }
}

/** Nunca lanza: quien lo llama esta cerrando sesion y no puede quedarse a medias. */
export async function borrarTokenRefresco(): Promise<void> {
  try {
    if (esWeb) {
      globalThis.localStorage?.removeItem(CLAVE_REFRESCO)
      return
    }
    await SecureStore.deleteItemAsync(CLAVE_REFRESCO, OPCIONES)
  } catch {
    // Si ni siquiera se puede borrar, no hay nada mejor que hacer aqui. El
    // servidor ya tiene la sesion revocada, que es lo que de verdad importa.
  }
}
