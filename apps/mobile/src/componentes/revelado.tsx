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
  clave,
  retraso = 900,
  duracion = 320,
  activo = true,
}: {
  children: ReactNode
  estilo?: StyleProp<ViewStyle>
  clave?: number
  retraso?: number
  duracion?: number
  activo?: boolean
}): React.JSX.Element {
  const { reducido, listo } = useEstadoMovimiento()
  const ancho = useSharedValue(0)
  const alto = useSharedValue(0)
  const fase = useSharedValue(0)
  const resuelto = useRef(false)
  const anterior = useRef(clave)
  useEffect(() => {
    if (!listo) return
    cancelAnimation(fase)
    const cambia = anterior.current !== clave
    anterior.current = clave
    if (!activo || reducido || (resuelto.current && !cambia)) fase.value = 1
    else {
      fase.value = 0
      fase.value = withDelay(retraso, withTiming(1, { duration: duracion, easing: CURVA.entrada }))
    }
    resuelto.current = true
    return () => cancelAnimation(fase)
  }, [listo, reducido, fase, clave, retraso, duracion, activo])
  const cortina = useAnimatedStyle(() => {
    const margen = Math.max(
      ancho.value * 0.15,
      (alto.value * Math.tan((ANGULO * Math.PI) / 180)) / 2,
    )
    const recorrido = ancho.value + 2 * margen
    return {
      left: ancho.value > 0 ? -margen : ("-50%" as const),
      width: ancho.value > 0 ? recorrido : ("200%" as const),
      opacity: fase.value >= 1 ? 0 : 1,
      transform: [{ translateX: recorrido * fase.value }, { skewX: `-${ANGULO}deg` }],
    }
  })
  return (
    <View
      style={[estilos.raiz, estilo]}
      onLayout={(evento) => {
        ancho.value = evento.nativeEvent.layout.width
        alto.value = evento.nativeEvent.layout.height
      }}
    >
      {children}
      {activo && (!listo || !reducido) && (
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
