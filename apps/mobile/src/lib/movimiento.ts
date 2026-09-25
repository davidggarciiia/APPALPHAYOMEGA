import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * Si la persona ha pedido al sistema que se mueva menos la pantalla.
 *
 * Reducir movimiento no significa quitarlo todo: se conservan los fundidos y los
 * cambios de color que explican que algo ha cambiado, y se quitan los
 * desplazamientos, las escalas y los rebotes. Por eso quien lo use elige un
 * fundido en lugar de un deslizamiento, no la ausencia de transicion.
 *
 * Escucha el cambio en vivo: si se activa en Ajustes con la app abierta, la
 * siguiente transicion ya lo respeta sin reiniciar.
 */
export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(false)

  useEffect(() => {
    let vigente = true

    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vigente) {
        setReducido(valor)
      }
    })

    const suscripcion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducido)

    return () => {
      vigente = false
      suscripcion.remove()
    }
  }, [])

  return reducido
}
