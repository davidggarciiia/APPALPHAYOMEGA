import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react"
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import { tema } from "../tema"
import { ANGULO, useMovimientoReducido } from "./movimiento"

type Barrido = { fase: SharedValue<number>; reducido: boolean }
const BarridoCompartido = createContext<Barrido | null>(null)

function useBarrido(compartido: Barrido | null = null): Barrido {
  const ajuste = useMovimientoReducido()
  const fase = useSharedValue(0)
  const reducido = compartido?.reducido ?? ajuste
  useEffect(() => {
    if (compartido) return
    cancelAnimation(fase)
    fase.value = 0
    if (!reducido)
      fase.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(fase)
  }, [compartido, reducido, fase])
  return useMemo(() => compartido ?? { fase, reducido }, [compartido, fase, reducido])
}

/** Agrupa el estado de carga de una pantalla en un único reloj de animación. */
export function GrupoEsqueletos({ children }: { children: ReactNode }): React.JSX.Element {
  const barrido = useBarrido()
  return <BarridoCompartido.Provider value={barrido}>{children}</BarridoCompartido.Provider>
}

export function Esqueleto({
  ancho = "100%",
  alto = 20,
  radio = 10,
  estilo,
}: {
  ancho?: DimensionValue
  alto?: number
  radio?: number
  estilo?: StyleProp<ViewStyle>
}): React.JSX.Element {
  const { fase, reducido } = useBarrido(useContext(BarridoCompartido))
  const medida = useSharedValue(typeof ancho === "number" ? ancho : 0)
  const barrido = useAnimatedStyle(() => ({
    transform: [
      { translateX: medida.value * (-0.4 + 1.6 * fase.value) },
      { skewX: `-${ANGULO}deg` },
    ],
  }))
  return (
    <View
      testID="esqueleto"
      style={[estilos.base, { width: ancho, height: alto, borderRadius: radio }, estilo]}
      onLayout={(evento) => {
        medida.value = evento.nativeEvent.layout.width
      }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {!reducido && <Animated.View testID="esqueleto-brillo" style={[estilos.brillo, barrido]} />}
    </View>
  )
}

const estilos = StyleSheet.create({
  base: { backgroundColor: tema.esqueletoBase, overflow: "hidden" },
  brillo: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "34%",
    backgroundColor: tema.esqueletoBrillo,
  },
})
