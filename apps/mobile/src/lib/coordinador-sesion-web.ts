import { Platform } from "react-native"

/** El navegador libera el candado si una pestaña se cierra durante la renovación. */
export function conCredencialesExclusivas<T>(accion: () => Promise<T>): Promise<T> {
  if (Platform.OS !== "web") return accion()
  if (typeof navigator === "undefined" || !navigator.locks)
    return Promise.reject(new Error("Este navegador no permite coordinar la sesión entre pestañas"))
  return navigator.locks.request("alpha-omega-credenciales", { mode: "exclusive" }, accion)
}
