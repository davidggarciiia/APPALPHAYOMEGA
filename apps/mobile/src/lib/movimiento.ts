import { useSyncExternalStore } from "react"
import { AccessibilityInfo } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

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
 *
 * La consulta al sistema es asincrona. Hasta que contesta se usa lo que leyo
 * Reanimated al arrancar, que no escucha cambios pero esta disponible desde el
 * primer fotograma: sin eso, la pantalla de carga empezaria la animacion
 * completa y la cambiaria a mitad al llegar la respuesta.
 */
export function useMovimientoReducido(): boolean {
  const alArrancar = useReducedMotion()
  return useSyncExternalStore(suscribirse, leer) ?? alArrancar
}

/** Null hasta que el sistema contesta. */
let reducido: boolean | null = null
const avisos = new Set<() => void>()
let dejarDeEscuchar: (() => void) | null = null

function leer(): boolean | null {
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
