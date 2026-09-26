import { useState } from "react"
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, { css, cubicBezier } from "react-native-reanimated"

import { useMovimientoReducido } from "../lib/movimiento"

const PressableAnimado = Animated.createAnimatedComponent(Pressable)

/** Salida fuerte: arranca deprisa, que es justo el momento que se esta mirando. */
const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/** Cuanto se atenua al pulsar con movimiento reducido, sobre la opacidad que ya tenga. */
const ATENUADO = 0.75

/**
 * Holgura para un enlace de texto de una linea. El texto mide unos 15 puntos de
 * alto y el dedo necesita 44. En horizontal se queda en 8 para no pisar al
 * vecino cuando dos enlaces van juntos.
 */
export const HOLGURA_DE_ENLACE = { top: 15, bottom: 15, left: 8, right: 8 } as const

export type PropsDePulsable = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
}

/**
 * Todo lo que se pulsa en la app pasa por aqui, para que responda igual en todas
 * las pantallas.
 *
 * Al apoyar el dedo se encoge un 3 % en 120 ms. La respuesta llega al tocar, no
 * al soltar: esperar a que acabe el toque para mostrar algo es la latencia que
 * se nota. La escala arrastra el texto con el boton, y por eso se lee como algo
 * fisico. Se pulsa decenas de veces al dia, asi que tiene que ser casi
 * imperceptible; mas largo o mas grande cansaria.
 *
 * La transicion la ejecuta Reanimated en el hilo de la interfaz. React solo se
 * entera dos veces por pulsacion, al apoyar y al soltar, no en cada fotograma.
 *
 * Con movimiento reducido no hay escala: el boton se atenua, que avisa igual de
 * que el toque ha llegado. Se atenua sobre la opacidad que ya tenga; si no, una
 * fila de un cliente de baja, que ya va apagada, se encenderia al pulsarla.
 *
 * Aplica su propia `transform`, asi que la de `style` se ignora.
 */
export function Pulsable({
  style,
  onPressIn,
  onPressOut,
  ...props
}: PropsDePulsable): React.JSX.Element {
  const [pulsado, setPulsado] = useState(false)
  const movimientoReducido = useMovimientoReducido()

  return (
    <PressableAnimado
      {...props}
      onPressIn={(evento) => {
        setPulsado(true)
        onPressIn?.(evento)
      }}
      onPressOut={(evento) => {
        setPulsado(false)
        onPressOut?.(evento)
      }}
      style={[
        style,
        estilos.transicion,
        pulsado &&
          (movimientoReducido ? { opacity: opacidadDe(style) * ATENUADO } : estilos.encogido),
      ]}
    />
  )
}

const estilos = css.create({
  transicion: {
    transform: [{ scale: 1 }],
    transitionProperty: ["transform", "opacity"],
    transitionDuration: 120,
    transitionTimingFunction: SALIDA,
  },
  encogido: { transform: [{ scale: 0.97 }] },
})

function opacidadDe(style: StyleProp<ViewStyle>): number {
  const { opacity } = StyleSheet.flatten(style)
  return typeof opacity === "number" ? opacity : 1
}
