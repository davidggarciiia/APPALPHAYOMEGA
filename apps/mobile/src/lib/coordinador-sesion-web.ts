import { Platform } from "react-native"

export const CLAVE_CUENTA_WEB = "alpha_omega_cuenta"

/** El navegador libera el candado si una pestaña se cierra durante la renovación. */
export function conCredencialesExclusivas<T>(accion: () => Promise<T>): Promise<T> {
  if (Platform.OS !== "web") return accion()
  if (typeof navigator === "undefined" || !navigator.locks)
    return Promise.reject(new Error("Este navegador no permite coordinar la sesión entre pestañas"))
  return navigator.locks.request("alpha-omega-credenciales", { mode: "exclusive" }, accion)
}

export function guardarCuentaWeb(cuenta: string): void {
  if (Platform.OS === "web") globalThis.localStorage?.setItem(CLAVE_CUENTA_WEB, cuenta)
}

export function leerCuentaWeb(): string | null {
  return Platform.OS === "web" ? (globalThis.localStorage?.getItem(CLAVE_CUENTA_WEB) ?? null) : null
}

export function borrarCuentaWeb(): void {
  if (Platform.OS === "web") globalThis.localStorage?.removeItem(CLAVE_CUENTA_WEB)
}
