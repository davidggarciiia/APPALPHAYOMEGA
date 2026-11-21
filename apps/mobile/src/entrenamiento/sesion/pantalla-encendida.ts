import { useEffect } from "react"
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake"

const ETIQUETA = "sesion-de-entrenamiento"

/**
 * Mantiene la pantalla encendida mientras `activa`: con la sesión abierta, sin pausa y
 * sin enviar. Si el sistema no la admite (web sin Wake Lock, tests), la sesión sigue igual.
 */
export function usePantallaEncendida(activa: boolean): void {
  useEffect(() => {
    if (!activa) return
    try {
      void activateKeepAwakeAsync(ETIQUETA).catch(() => undefined)
    } catch {
      /* Sin soporte: la pantalla se apagará según los ajustes del dispositivo. */
    }
    return () => {
      try {
        void deactivateKeepAwake(ETIQUETA).catch(() => undefined)
      } catch {
        /* Nada que soltar. */
      }
    }
  }, [activa])
}
