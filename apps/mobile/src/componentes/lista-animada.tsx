import { useMemo, type ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import Animated, {
  LinearTransition,
  ReduceMotion,
  withTiming,
  type LayoutAnimation,
} from "react-native-reanimated"

import { caida, CURVA, DURACION, RAYO, useMovimientoReducido } from "./movimiento"

const transicion = LinearTransition.duration(DURACION.normal)
  .easing(CURVA.entrada)
  .reduceMotion(ReduceMotion.System)

type AnimacionLista = {
  entering?: () => LayoutAnimation
  exiting?: () => LayoutAnimation
  layout?: LinearTransition
}

function salida(): LayoutAnimation {
  "worklet"
  const opciones = { duration: DURACION.rapido, easing: CURVA.salida }
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
    animations: {
      opacity: withTiming(0, opciones),
      transform: [
        { translateX: withTiming(-RAYO.x, opciones) },
        { translateY: withTiming(-RAYO.y, opciones) },
      ],
    },
  }
}

/** Se calcula en el padre para que una fila nueva conozca el ajuste antes de entrar. */
export function useAnimacionLista(): AnimacionLista {
  const reducido = useMovimientoReducido()
  return useMemo(
    () => (reducido ? {} : { entering: caida(0), exiting: salida, layout: transicion }),
    [reducido],
  )
}

export function ListaAnimada({
  children,
  style,
  testID,
  animacion,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
  animacion?: AnimacionLista
}): React.JSX.Element {
  return (
    <Animated.View {...animacion} style={style} testID={testID} collapsable={false}>
      {children}
    </Animated.View>
  )
}
