import { useEffect, useRef, type ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { CURVA, RAYO, useEstadoMovimiento } from "./movimiento"

/** Una entrada por grupo, también cuando la consulta de accesibilidad termina tarde. */
export function EntradaMarca({
  children,
  indice = 0,
  style,
}: {
  children: ReactNode
  indice?: number
  style?: StyleProp<ViewStyle>
}): React.JSX.Element {
  const { listo, reducido } = useEstadoMovimiento()
  const iniciada = useRef(false)
  const avance = useSharedValue(1)
  useEffect(() => {
    if (!listo) return
    cancelAnimation(avance)
    if (reducido || iniciada.current || indice >= 8) avance.value = 1
    else {
      avance.value = 0
      avance.value = withDelay(
        Math.max(0, indice) * 40,
        withTiming(1, { duration: 260, easing: CURVA.entrada }),
      )
    }
    iniciada.current = true
    return () => cancelAnimation(avance)
  }, [avance, indice, listo, reducido])
  const entrada = useAnimatedStyle(() => ({
    opacity: avance.value,
    transform: [
      { translateX: RAYO.x * (1 - avance.value) },
      { translateY: RAYO.y * (1 - avance.value) },
    ],
  }))
  return <Animated.View style={[style, entrada]}>{children}</Animated.View>
}

export function CambioDeContenido({
  children,
  clave,
}: {
  children: ReactNode
  clave: string
}): React.JSX.Element {
  const { listo, reducido } = useEstadoMovimiento()
  const opacidad = useSharedValue(1)
  const anterior = useRef(clave)
  useEffect(() => {
    const cambia = anterior.current !== clave
    anterior.current = clave
    cancelAnimation(opacidad)
    if (!listo || reducido || !cambia) opacidad.value = 1
    else {
      opacidad.value = 0
      opacidad.value = withTiming(1, { duration: 160, easing: CURVA.entrada })
    }
    return () => cancelAnimation(opacidad)
  }, [clave, listo, reducido, opacidad])
  const estilo = useAnimatedStyle(() => ({ opacity: opacidad.value }))
  return <Animated.View style={estilo}>{children}</Animated.View>
}
