import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from "expo-crypto"
import { crearAlmacenLocal } from "./almacen-local"
import { persistencia } from "./persistencia"
import { recuperarClave } from "./clave-local"

const opciones = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const nombreClave = (cuenta: string): string => `ao.cifrado.${cuenta}`
async function leerClave(cuenta: string, crear: boolean): Promise<AESEncryptionKey> {
  const nombre = nombreClave(cuenta)
  const texto = await recuperarClave(
    {
      leer: async () =>
        Platform.OS === "web"
          ? localStorage.getItem(nombre)
          : SecureStore.getItemAsync(nombre, opciones),
      crear: async () => (await AESEncryptionKey.generate()).encoded("hex"),
      guardar: async (valor) => {
        if (Platform.OS === "web") localStorage.setItem(nombre, valor)
        else await SecureStore.setItemAsync(nombre, valor, opciones)
      },
      hayDocumentos: async () => (await persistencia.listar(cuenta)).length > 0,
    },
    crear,
  )
  return AESEncryptionKey.import(texto, "hex")
}
const codificador = new TextEncoder()
const contexto = (cuenta: string, clave: string): Uint8Array =>
  codificador.encode(`${cuenta}/${clave}`)

export const almacenDispositivo = crearAlmacenLocal(persistencia, {
  cifrar: async (cuenta, clave, texto) => {
    const resultado = await aesEncryptAsync(
      codificador.encode(texto),
      await leerClave(cuenta, true),
      { additionalData: contexto(cuenta, clave) },
    )
    return resultado.combined("base64")
  },
  descifrar: async (cuenta, clave, texto) => {
    const resultado = await aesDecryptAsync(
      AESSealedData.fromCombined(texto),
      await leerClave(cuenta, false),
      { additionalData: contexto(cuenta, clave) },
    )
    return new TextDecoder().decode(resultado)
  },
  olvidar: async (cuenta) => {
    if (Platform.OS === "web") localStorage.removeItem(nombreClave(cuenta))
    else await SecureStore.deleteItemAsync(nombreClave(cuenta), opciones)
  },
})
