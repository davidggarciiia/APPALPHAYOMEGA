import { useCallback, useEffect, useState } from "react"
import { AccessibilityInfo, type ViewStyle } from "react-native"
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
  type AnimatedStyle,
} from "react-native-reanimated"

export const ANGULO = 20
export const DURACION = { rapido: 120, normal: 220, lento: 360 } as const
export const CURVA = {
  entrada: Easing.out(Easing.cubic),
  salida: Easing.in(Easing.cubic),
  suave: Easing.inOut(Easing.cubic),
}
export const ENTRADA = { damping: 22, stiffness: 520, mass: 0.5 }
export const SALIDA = { damping: 9, stiffness: 340, mass: 0.55 }
export const HOJA = { damping: 28, stiffness: 300, mass: 0.9 }
export const INDICADOR = { damping: 20, stiffness: 260, mass: 0.7 }

/** Distingue la consulta pendiente de un ajuste reducido confirmado. */
export function useEstadoMovimiento(): { reducido: boolean; listo: boolean } {
  const [estado, fijar] = useState({ reducido: true, listo: false })
  useEffect(() => {
    let vivo = true
    let cambio = false
    const actualizar = (activo: boolean): void => {
      fijar((previo) =>
        previo.listo && previo.reducido === activo ? previo : { reducido: activo, listo: true },
      )
    }
    const suscripcion = AccessibilityInfo.addEventListener("reduceMotionChanged", (activo) => {
      cambio = true
      actualizar(activo)
    })
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((activo) => {
        if (vivo && !cambio) actualizar(activo)
      })
    return () => {
      vivo = false
      suscripcion.remove()
    }
  }, [])
  return estado
}

/** Hasta conocer el ajuste no se inicia ninguna animación decorativa. */
export function useMovimientoReducido(): boolean {
  return useEstadoMovimiento().reducido
}

// Compartido por filas, progreso y botones: el último evento apaga el anterior.
let destelloActivo: (() => void) | undefined

export function useDestello(ancho: number | SharedValue<number>): {
  estilo: AnimatedStyle<ViewStyle>
  disparar: () => void
} {
  const reducido = useMovimientoReducido()
  const d = useSharedValue(1)
  const apagar = useCallback(() => {
    cancelAnimation(d)
    d.value = 1
  }, [d])
  useEffect(() => {
    if (reducido) apagar()
    return () => {
      apagar()
      if (destelloActivo === apagar) destelloActivo = undefined
    }
  }, [reducido, apagar])
  const disparar = useCallback(() => {
    if (reducido) return
    destelloActivo?.()
    destelloActivo = apagar
    d.value = 0
    d.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })
  }, [reducido, apagar, d])
  const estilo = useAnimatedStyle(() => ({
    opacity: reducido ? 0 : 0.75 * (1 - d.value) ** 2,
    transform: [
      { translateX: -44 + d.value * ((typeof ancho === "number" ? ancho : ancho.value) + 88) },
      { skewX: `-${ANGULO}deg` },
    ],
  }))
  return { estilo, disparar }
}
