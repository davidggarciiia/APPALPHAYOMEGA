import { TextDecoder, TextEncoder } from "node:util"
import { Platform } from "react-native"
import { z } from "zod"
import type { AlmacenLocal } from "./almacen-local"

let mockNumeroClave = 0
const mockLlavesNativas = new Map<string, string>()
const mockEntradasNativas: Uint8Array[] = []
jest.mock("./persistencia", () => jest.requireActual("./persistencia.web"))
jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (clave: string) => mockLlavesNativas.get(clave) ?? null,
  setItemAsync: async (clave: string, valor: string) => {
    mockLlavesNativas.set(clave, valor)
  },
  deleteItemAsync: async (clave: string) => {
    mockLlavesNativas.delete(clave)
  },
}))
jest.mock("expo-crypto", () => ({
  AESEncryptionKey: {
    generate: async () => {
      mockNumeroClave++
      const clave = jest
        .requireActual<typeof import("node:crypto")>("node:crypto")
        .randomBytes(32)
        .toString("hex")
      await Promise.resolve()
      return { encoded: () => clave }
    },
    import: async (clave: string) => clave,
  },
  // El convertidor Kotlin de ByteArray exige UINT8_TYPED_ARRAY. El wrapper JS
  // del SDK instalado deja un string sin convertir: esta frontera lo rechaza.
  AESSealedData: {
    fromCombined: (datos: Uint8Array | string) => {
      if (
        typeof datos === "string" &&
        jest.requireActual<typeof import("react-native")>("react-native").Platform.OS === "web"
      )
        return Uint8Array.from(Buffer.from(datos, "base64"))
      if (!(datos instanceof Uint8Array))
        throw new TypeError("fromCombined: expected UINT8_TYPED_ARRAY")
      mockEntradasNativas.push(datos)
      return datos
    },
  },
  aesEncryptAsync: async (
    texto: Uint8Array,
    clave: string,
    opciones: { additionalData: Uint8Array },
  ) => {
    const crypto = jest.requireActual<typeof import("node:crypto")>("node:crypto")
    const iv = crypto.randomBytes(12)
    const cifrado = crypto.createCipheriv("aes-256-gcm", Buffer.from(clave, "hex"), iv)
    cifrado.setAAD(opciones.additionalData)
    const sellado = Buffer.concat([
      iv,
      cifrado.update(texto),
      cifrado.final(),
      cifrado.getAuthTag(),
    ])
    return {
      combined: (formato: string) => {
        if (formato !== "base64") throw new Error("Formato inesperado")
        return sellado.toString("base64")
      },
    }
  },
  aesDecryptAsync: async (
    sellado: Uint8Array,
    clave: string,
    opciones: { additionalData: Uint8Array },
  ) => {
    const crypto = jest.requireActual<typeof import("node:crypto")>("node:crypto")
    const datos = Buffer.from(sellado)
    const descifrado = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(clave, "hex"),
      datos.subarray(0, 12),
    )
    descifrado.setAAD(opciones.additionalData)
    descifrado.setAuthTag(datos.subarray(-16))
    return Uint8Array.from(
      Buffer.concat([descifrado.update(datos.subarray(12, -16)), descifrado.final()]),
    )
  },
}))

it("dos almacenes web crean la misma clave y pueden reabrir los documentos de ambos", async () => {
  const propiedades = ["localStorage", "navigator", "TextEncoder", "TextDecoder"] as const
  const anteriores = propiedades.map((clave) => Object.getOwnPropertyDescriptor(globalThis, clave))
  const plataformaAnterior = Platform.OS
  const valores: Record<string, string> = {}
  const colas = new Map<string, Promise<unknown>>()
  const almacenamiento = {
    getItem: (clave: string) => valores[clave] ?? null,
    setItem: (clave: string, valor: string) => {
      valores[clave] = valor
      Object.defineProperty(almacenamiento, clave, {
        value: valor,
        configurable: true,
        enumerable: true,
      })
    },
    removeItem: (clave: string) => {
      delete valores[clave]
      Reflect.deleteProperty(almacenamiento, clave)
    },
  }
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" })
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: almacenamiento })
  Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder })
  Object.defineProperty(globalThis, "TextDecoder", { configurable: true, value: TextDecoder })
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: (nombre: string, _opciones: unknown, accion: () => Promise<unknown>) => {
          const siguiente = (colas.get(nombre) ?? Promise.resolve()).then(accion)
          colas.set(
            nombre,
            siguiente.catch(() => undefined),
          )
          return siguiente
        },
      },
    },
  })
  try {
    mockNumeroClave = 0
    let a!: AlmacenLocal, b!: AlmacenLocal
    jest.isolateModules(() => {
      a =
        jest.requireActual<typeof import("./almacen-dispositivo")>(
          "./almacen-dispositivo",
        ).almacenDispositivo
    })
    jest.isolateModules(() => {
      b =
        jest.requireActual<typeof import("./almacen-dispositivo")>(
          "./almacen-dispositivo",
        ).almacenDispositivo
    })
    const cuenta = "10000000-0000-4000-8000-000000000000"
    await Promise.all([a.guardar(cuenta, "A", "borrador A"), b.guardar(cuenta, "B", "borrador B")])
    expect(mockNumeroClave).toBe(1)
    expect(await b.leer(cuenta, "A", z.string())).toBe("borrador A")
    expect(await a.leer(cuenta, "B", z.string())).toBe("borrador B")
  } finally {
    Object.defineProperty(Platform, "OS", { configurable: true, value: plataformaAnterior })
    propiedades.forEach((clave, i) => {
      const anterior = anteriores[i]
      if (anterior) Object.defineProperty(globalThis, clave, anterior)
      else Reflect.deleteProperty(globalThis, clave)
    })
  }
})

it.each(["Entrenamiento ñ 💪", "copia anterior", "copia anterior."])(
  "Android reabre una copia Base64 existente sin cambiarla: %s",
  async (notas) => {
    const crypto = jest.requireActual<typeof import("node:crypto")>("node:crypto")
    const cuenta = "10000000-0000-4000-8000-000000000000"
    const clave = "sesion-anterior"
    const key = Buffer.from("0123456789abcdef".repeat(4), "hex")
    const iv = Buffer.from([0, 127, 128, 255, 1, 2, 3, 4, 5, 6, 7, 8])
    const cifrado = crypto.createCipheriv("aes-256-gcm", key, iv)
    cifrado.setAAD(Buffer.from(`${cuenta}/${clave}`))
    const original = Buffer.concat([
      iv,
      cifrado.update(JSON.stringify({ version: 1, datos: { notas } })),
      cifrado.final(),
      cifrado.getAuthTag(),
    ]).toString("base64")
    const propiedades = ["localStorage", "TextEncoder", "TextDecoder"] as const
    const anteriores = propiedades.map((nombre) =>
      Object.getOwnPropertyDescriptor(globalThis, nombre),
    )
    const plataformaAnterior = Platform.OS
    const almacenado = new Map([[`ao.documento.${cuenta}.${clave}`, original]])
    const almacenamiento = {
      getItem: (nombre: string) => almacenado.get(nombre) ?? null,
      setItem: (nombre: string, valor: string) => {
        almacenado.set(nombre, valor)
      },
    }
    Object.defineProperty(Platform, "OS", { configurable: true, value: "android" })
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: almacenamiento })
    Object.defineProperty(globalThis, "TextEncoder", { configurable: true, value: TextEncoder })
    Object.defineProperty(globalThis, "TextDecoder", { configurable: true, value: TextDecoder })
    mockLlavesNativas.set(`ao.cifrado.${cuenta}`, key.toString("hex"))
    mockEntradasNativas.length = 0
    const numeroInicial = mockNumeroClave
    try {
      let almacen!: AlmacenLocal
      jest.isolateModules(() => {
        almacen =
          jest.requireActual<typeof import("./almacen-dispositivo")>(
            "./almacen-dispositivo",
          ).almacenDispositivo
      })
      await expect(almacen.leer(cuenta, clave, z.object({ notas: z.string() }))).resolves.toEqual({
        notas,
      })
      expect(mockEntradasNativas.at(-1)).toEqual(Uint8Array.from(Buffer.from(original, "base64")))
      expect(mockNumeroClave).toBe(numeroInicial)
      expect(almacenado.get(`ao.documento.${cuenta}.${clave}`)).toBe(original)
      expect(mockLlavesNativas.get(`ao.cifrado.${cuenta}`)).toBe(key.toString("hex"))
    } finally {
      mockLlavesNativas.clear()
      Object.defineProperty(Platform, "OS", { configurable: true, value: plataformaAnterior })
      propiedades.forEach((nombre, i) => {
        const anterior = anteriores[i]
        if (anterior) Object.defineProperty(globalThis, nombre, anterior)
        else Reflect.deleteProperty(globalThis, nombre)
      })
    }
  },
)
