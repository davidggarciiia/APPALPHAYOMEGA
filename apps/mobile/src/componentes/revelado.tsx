import { useEffect, useRef, type ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"

import { tema } from "../tema"
import { ANGULO, CURVA, useEstadoMovimiento } from "./movimiento"

export function Revelado({
  children,
  estilo,
}: {
  children: ReactNode
  estilo?: StyleProp<ViewStyle>
}): React.JSX.Element {
  const { reducido, listo } = useEstadoMovimiento()
  const ancho = useSharedValue(0)
  const fase = useSharedValue(0)
  const resuelto = useRef(false)
  useEffect(() => {
    if (!listo) return
    cancelAnimation(fase)
    if (reducido || resuelto.current) fase.value = 1
    else {
      fase.value = withDelay(900, withTiming(1, { duration: 320, easing: CURVA.entrada }))
    }
    resuelto.current = true
    return () => cancelAnimation(fase)
  }, [listo, reducido, fase])
  const cortina = useAnimatedStyle(() => ({
    opacity: fase.value >= 1 ? 0 : 1,
    transform: [{ translateX: ancho.value * 1.1 * fase.value }, { skewX: `-${ANGULO}deg` }],
  }))
  return (
    <View
      style={[estilos.raiz, estilo]}
      onLayout={(evento) => {
        ancho.value = evento.nativeEvent.layout.width
      }}
    >
      {children}
      {(!listo || !reducido) && (
        <Animated.View
          testID="revelado-cortina"
          style={[estilos.cortina, cortina]}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  raiz: { overflow: "hidden" },
  cortina: {
    position: "absolute",
    left: "-15%",
    top: 0,
    bottom: 0,
    width: "130%",
    backgroundColor: tema.fondo,
  },
})
