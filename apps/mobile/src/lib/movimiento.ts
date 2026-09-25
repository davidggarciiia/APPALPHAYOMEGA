import { useSyncExternalStore } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * Si la persona ha pedido al sistema que se mueva menos la pantalla.
 *
 * Reducir movimiento no significa quitarlo todo: se conservan los fundidos y los
 * cambios de color que explican que algo ha cambiado, y se quitan los
 * desplazamientos, las escalas y los rebotes. Por eso quien lo use elige un
 * fundido en lugar de un deslizamiento, no la ausencia de respuesta.
 *
 * Escucha el cambio en vivo: si se activa en Ajustes con la app abierta, lo
 * siguiente que se mueva ya lo respeta sin reiniciar.
 *
 * Lo consulta cada boton de la app, asi que todos comparten una sola
 * suscripcion al sistema en lugar de abrir una por boton.
 */
export function useMovimientoReducido(): boolean {
  return useSyncExternalStore(suscribirse, leer)
}

let reducido = false
const avisos = new Set<() => void>()
let dejarDeEscuchar: (() => void) | null = null

function leer(): boolean {
  return reducido
}

function fijar(valor: boolean): void {
  if (valor === reducido) {
    return
  }

  reducido = valor
  avisos.forEach((avisar) => {
    avisar()
  })
}

function suscribirse(avisar: () => void): () => void {
  avisos.add(avisar)

  if (dejarDeEscuchar === null) {
    const suscripcion = AccessibilityInfo.addEventListener("reduceMotionChanged", fijar)
    void AccessibilityInfo.isReduceMotionEnabled().then(fijar)
    dejarDeEscuchar = () => {
      suscripcion.remove()
    }
  }

  return () => {
    avisos.delete(avisar)

    if (avisos.size === 0 && dejarDeEscuchar !== null) {
      dejarDeEscuchar()
      dejarDeEscuchar = null
    }
  }
}
