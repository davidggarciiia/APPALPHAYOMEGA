import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from "expo-crypto"
import { crearAlmacenLocal } from "./almacen-local"
import { persistencia } from "./persistencia"
import { recuperarClave } from "./clave-local"
import { conRecursoLocalExclusivo } from "../lib/candado-local"

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
      exclusiva: (accion) => conRecursoLocalExclusivo(`ao-clave-${cuenta}`, accion),
    },
    crear,
  )
  return AESEncryptionKey.import(texto, "hex")
}
const codificador = new TextEncoder()
const contexto = (cuenta: string, clave: string): Uint8Array =>
  codificador.encode(`${cuenta}/${clave}`)

/** La copia sigue almacenada en Base64; el puente Android recibe sus bytes. */
function bytesDeBase64(texto: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(texto))
    throw new Error("La copia local no tiene un formato Base64 válido.")
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  const relleno = texto.endsWith("==") ? 2 : texto.endsWith("=") ? 1 : 0
  const bytes = new Uint8Array((texto.length / 4) * 3 - relleno)
  let destino = 0
  for (let i = 0; i < texto.length; i += 4) {
    const bloque =
      (alfabeto.indexOf(texto.charAt(i)) << 18) |
      (alfabeto.indexOf(texto.charAt(i + 1)) << 12) |
      ((texto.charAt(i + 2) === "=" ? 0 : alfabeto.indexOf(texto.charAt(i + 2))) << 6) |
      (texto.charAt(i + 3) === "=" ? 0 : alfabeto.indexOf(texto.charAt(i + 3)))
    bytes[destino++] = (bloque >>> 16) & 255
    if (destino < bytes.length) bytes[destino++] = (bloque >>> 8) & 255
    if (destino < bytes.length) bytes[destino++] = bloque & 255
  }
  return bytes
}

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
      AESSealedData.fromCombined(bytesDeBase64(texto)),
      await leerClave(cuenta, false),
      { additionalData: contexto(cuenta, clave) },
    )
    return new TextDecoder().decode(resultado)
  },
  olvidar: async (cuenta) => {
    await conRecursoLocalExclusivo(`ao-clave-${cuenta}`, async () => {
      if (Platform.OS === "web") localStorage.removeItem(nombreClave(cuenta))
      else await SecureStore.deleteItemAsync(nombreClave(cuenta), opciones)
    })
  },
})
