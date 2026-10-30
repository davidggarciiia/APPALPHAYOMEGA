import { useEffect, useRef, type ReactNode } from "react"
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { alto, tema } from "../tema"
import { ENTRADA, SALIDA, useMovimientoReducido } from "./movimiento"

const PressableAnimado = Animated.createAnimatedComponent(Pressable)

/** Respuesta de marca para filas y tarjetas, conservando su distribución. */
export function Pulsable({
  children,
  style,
  disabled = false,
  accessibilityRole = "button",
  accessibilityState,
  onPressIn,
  onPressOut,
  ...props
}: Omit<PressableProps, "children" | "style"> & {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const desactivado = disabled === true || accessibilityState?.disabled === true
  const presionado = useRef(false)
  const pulso = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(pulso)
    if (desactivado) presionado.current = false
    pulso.value = presionado.current ? 1 : 0
    return () => cancelAnimation(pulso)
  }, [desactivado, reducido, pulso])
  const movimiento = useAnimatedStyle(() => ({
    transform: [{ scale: reducido ? 1 : 1 - 0.015 * pulso.value }],
  }))
  const borde = useAnimatedStyle(() => ({ opacity: pulso.value }))
  return (
    <PressableAnimado
      {...props}
      disabled={desactivado}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: desactivado }}
      style={[s.area, style, movimiento]}
      onPressIn={(evento: GestureResponderEvent) => {
        if (desactivado) return
        presionado.current = true
        pulso.value = reducido ? 1 : withSpring(1, ENTRADA)
        onPressIn?.(evento)
      }}
      onPressOut={(evento: GestureResponderEvent) => {
        presionado.current = false
        pulso.value = reducido || desactivado ? 0 : withSpring(0, SALIDA)
        onPressOut?.(evento)
      }}
    >
      {children}
      <Animated.View
        testID="pulsable-borde"
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={[s.borde, { borderRadius: StyleSheet.flatten(style)?.borderRadius ?? 0 }, borde]}
      />
    </PressableAnimado>
  )
}

const s = StyleSheet.create({
  area: { minWidth: alto.tactil, minHeight: alto.tactil },
  borde: { ...StyleSheet.absoluteFill, borderWidth: 1.5, borderColor: tema.acento },
})
