/**
 * Recuerda a qué pantalla quería ir quien llegó sin sesión (un enlace a una ruta
 * protegida, o una sesión caducada) para llevarle allí tras entrar.
 *
 * Solo se guardan rutas internas de la app: nunca una dirección externa ni algo
 * que parezca un esquema. Vive en memoria; no se persiste.
 */
const RUTAS_SIN_DESTINO = ["login", "activar", "recuperar", "restablecer"]

let pendiente: string | null = null
/** Si ya hubo una sesión abierta en esta ejecución: distingue un enlace en frío de un cierre de sesión. */
let huboSesion = false

export function marcarSesionIniciada(): void {
  huboSesion = true
}

/** Solo se recuerda el destino de un enlace en frío o de una sesión caducada, no tras cerrar sesión a propósito. */
export function guardarDestinoSiProcede(ruta: string | null | undefined, caducada: boolean): void {
  if (caducada || !huboSesion) guardarDestino(ruta)
  else olvidarDestino()
}

/** Una ruta interna válida de la app: empieza por una sola barra y no lleva esquema. */
export function esRutaInterna(ruta: string | null | undefined): ruta is string {
  if (typeof ruta !== "string" || ruta.length === 0 || ruta.length > 300) return false
  if (!ruta.startsWith("/") || ruta.startsWith("//")) return false
  if (ruta.includes("\\") || ruta.includes("://")) return false
  if ([...ruta].some((letra) => letra.charCodeAt(0) < 32)) return false
  const primero = ruta.split(/[/?#]/).filter(Boolean)[0] ?? ""
  return !RUTAS_SIN_DESTINO.includes(primero)
}

/** Guarda el destino si es válido; la raíz no cuenta porque ya es el destino por defecto. */
export function guardarDestino(ruta: string | null | undefined): void {
  if (esRutaInterna(ruta) && ruta !== "/") pendiente = ruta
}

/** Devuelve el destino guardado una sola vez. */
export function tomarDestino(): string | null {
  const destino = pendiente
  pendiente = null
  return destino
}

export function olvidarDestino(): void {
  pendiente = null
}

/** Solo para las pruebas: vuelve al estado de una ejecución recién abierta. */
export function reiniciarDestino(): void {
  pendiente = null
  huboSesion = false
}
