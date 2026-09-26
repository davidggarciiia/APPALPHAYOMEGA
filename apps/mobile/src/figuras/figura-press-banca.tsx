import { useEffect, useState } from "react"
import { Keyboard, StyleSheet, View } from "react-native"
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated"
import Svg, { Circle, Path } from "react-native-svg"

/*
 * El press banca del export de Claude Design (Sesion.dc.html), trazo a trazo.
 *
 * Lienzo de 200 × 120. Lo fijo (suelo, banco, cabeza, tronco y pierna) va en una
 * capa; el brazo y el disco en otras dos, animadas con `transform` como los
 * `@keyframes ao-arm` y `ao-bar` del diseño: el brazo se encoge a la mitad desde
 * el hombro y el disco baja 22 unidades, con pausa arriba y abajo.
 *
 * Animación CSS de Reanimated: corre en el hilo de UI y React no vuelve a pintar
 * nada mientras dura.
 */

const CUERPO = "#D9D3C6"
const APARATO = "#5A544A"
const SUELO = "#34302A"
const ORO = "#FFC34C"

/** Movimiento sobre la pantalla: curva de entrada y salida marcada. */
const RECORRIDO = cubicBezier(0.77, 0, 0.175, 1)

const BAJA_LA_BARRA = {
  "0%": { transform: [{ translateY: "0%" }] },
  "12%": { transform: [{ translateY: "0%" }] },
  // 22 de 120 unidades del lienzo.
  "50%": { transform: [{ translateY: "18.333%" }] },
  "62%": { transform: [{ translateY: "18.333%" }] },
  "100%": { transform: [{ translateY: "0%" }] },
} as const

const DOBLA_EL_BRAZO = {
  "0%": { transform: [{ scaleY: 1 }] },
  "12%": { transform: [{ scaleY: 1 }] },
  "50%": { transform: [{ scaleY: 0.5 }] },
  "62%": { transform: [{ scaleY: 0.5 }] },
  "100%": { transform: [{ scaleY: 1 }] },
} as const

/** Con el teclado abierto se está escribiendo una serie: la figura se queda quieta. */
function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    const mostrar = Keyboard.addListener("keyboardDidShow", () => setAbierto(true))
    const ocultar = Keyboard.addListener("keyboardDidHide", () => setAbierto(false))
    return () => {
      mostrar.remove()
      ocultar.remove()
    }
  }, [])
  return abierto
}

export function FiguraPressBanca({ ancho = 236 }: { ancho?: number }): React.JSX.Element {
  const movimientoReducido = useReducedMotion()
  const tecladoAbierto = useTecladoAbierto()
  const alto = (ancho * 120) / 200
  const animacion = (fotogramas: typeof BAJA_LA_BARRA | typeof DOBLA_EL_BRAZO) =>
    movimientoReducido
      ? {}
      : {
          animationName: fotogramas,
          animationDuration: 2600,
          animationIterationCount: "infinite" as const,
          animationTimingFunction: RECORRIDO,
          animationPlayState: tecladoAbierto ? ("paused" as const) : ("running" as const),
        }

  return (
    <View
      style={{ width: ancho, height: alto }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={ancho} height={alto} viewBox="0 0 200 120" fill="none">
        <Path d="M24 110h152" stroke={SUELO} strokeWidth={2} strokeLinecap="round" />
        <Path d="M44 90h92" stroke={APARATO} strokeWidth={5} strokeLinecap="round" />
        <Path d="M56 92v18M124 92v18" stroke={APARATO} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={47} cy={79} r={7} stroke={CUERPO} strokeWidth={3} />
        <Path d="M57 83h60" stroke={CUERPO} strokeWidth={6} strokeLinecap="round" />
        <Path
          d="M117 83l22-6 8 33"
          stroke={CUERPO}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {/* El brazo se encoge desde el hombro (72, 82): 36 % y 68,3 % del lienzo. */}
      <Animated.View
        style={[estilos.capa, { transformOrigin: "36% 68.333%" }, animacion(DOBLA_EL_BRAZO)]}
      >
        <Svg width={ancho} height={alto} viewBox="0 0 200 120" fill="none">
          <Path
            d="M72 82L84 62L72 42"
            stroke={CUERPO}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[estilos.capa, animacion(BAJA_LA_BARRA)]}>
        <Svg width={ancho} height={alto} viewBox="0 0 200 120" fill="none">
          <Circle cx={72} cy={40} r={13} stroke={ORO} strokeWidth={3} />
          <Circle cx={72} cy={40} r={3} fill={ORO} />
        </Svg>
      </Animated.View>
    </View>
  )
}

const estilos = StyleSheet.create({
  capa: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
})
