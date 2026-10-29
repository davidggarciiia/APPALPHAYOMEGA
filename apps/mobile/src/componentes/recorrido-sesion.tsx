import { useEffect, useRef } from "react"
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { tema } from "../tema"
import { vibrar } from "./botones"
import { ANGULO, CURVA, useDestello, useMovimientoReducido } from "./movimiento"

export function RecorridoSesion({
  hechas,
  total,
  estilo,
  demora = 0,
}: {
  hechas: number
  total: number
  estilo?: StyleProp<ViewStyle>
  /** Permite que termine la animación de la serie antes de mover el recorrido. */
  demora?: number
}): React.JSX.Element {
  const { fontScale } = useWindowDimensions()
  // Compensa el alto de línea de Anton sin mover la pista al ampliar la fuente.
  const margenLetra = { marginVertical: -2 * fontScale }
  const maximo = Math.max(0, Number.isFinite(total) ? total : 0)
  const actual = Math.min(maximo, Math.max(0, Number.isFinite(hechas) ? hechas : 0))
  const proporcion = maximo > 0 ? actual / maximo : 0
  const completo = maximo > 0 && actual >= maximo
  const retraso = Number.isFinite(demora) ? Math.max(0, demora) : 0
  const reducido = useMovimientoReducido()
  const ancho = useSharedValue(0)
  const avance = useSharedValue(proporcion)
  const luz = useSharedValue(completo ? 1 : 0)
  const previo = useRef(completo)
  const { estilo: brillo, disparar } = useDestello(ancho)

  useEffect(() => {
    cancelAnimation(avance)
    cancelAnimation(luz)
    let inicio: ReturnType<typeof setTimeout> | undefined
    const avanzar = (): void => {
      avance.value = withTiming(proporcion, { duration: 260, easing: CURVA.entrada })
    }
    if (reducido) avance.value = proporcion
    else if (retraso > 0) inicio = setTimeout(avanzar, retraso)
    else avanzar()
    const llego = completo && !previo.current
    previo.current = completo
    if (llego) vibrar("exito")
    let cierre: ReturnType<typeof setTimeout> | undefined
    if (reducido || !completo) luz.value = completo ? 1 : 0
    else if (llego || luz.value < 1) {
      // Acaba el relleno antes de encender Ω y barrer: nunca hay tres animaciones propias.
      cierre = setTimeout(() => {
        luz.value = withTiming(1, { duration: 160, easing: CURVA.entrada })
        disparar()
      }, retraso + 260)
    }
    return () => {
      clearTimeout(inicio)
      clearTimeout(cierre)
      cancelAnimation(avance)
      cancelAnimation(luz)
    }
  }, [proporcion, completo, reducido, retraso, avance, luz, disparar])

  const relleno = useAnimatedStyle(() => ({ transform: [{ scaleX: avance.value }] }))
  const cabeza = useAnimatedStyle(() => ({
    opacity: avance.value > 0 ? 1 : 0,
    transform: [
      { translateX: Math.max(0, ancho.value - 6) * avance.value },
      { skewX: `-${ANGULO}deg` },
    ],
  }))
  const omega = useAnimatedStyle(() => ({
    color: interpolateColor(luz.value, [0, 1], [tema.textoTenue, tema.acento]),
  }))

  return (
    <View
      style={[estilos.fila, estilo]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Progreso de la sesión"
      accessibilityValue={{ min: 0, max: maximo, now: actual }}
    >
      <Text style={[estilos.letra, margenLetra]} accessible={false}>
        Α
      </Text>
      <View
        testID="recorrido-pista"
        style={estilos.pista}
        onLayout={(evento) => {
          ancho.value = evento.nativeEvent.layout.width
        }}
      >
        <Animated.View style={[estilos.relleno, relleno]} />
        <Animated.View style={[estilos.cabeza, cabeza]} />
        {!reducido && (
          <View style={estilos.recorte} pointerEvents="none">
            <Animated.View style={[estilos.brillo, brillo]} />
          </View>
        )}
      </View>
      <Animated.Text style={[estilos.letra, margenLetra, omega]} accessible={false}>
        Ω
      </Animated.Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  letra: {
    fontFamily: tema.fuenteTitulo,
    fontSize: 15,
    lineHeight: 24,
    overflow: "visible",
    color: tema.textoTenue,
  },
  pista: { flex: 1, height: 4, backgroundColor: tema.borde },
  relleno: { ...StyleSheet.absoluteFill, backgroundColor: tema.acento, transformOrigin: "0% 50%" },
  cabeza: {
    position: "absolute",
    left: 0,
    top: -4,
    width: 6,
    height: 12,
    backgroundColor: tema.acentoClaro,
  },
  recorte: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  brillo: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 34,
    backgroundColor: tema.acentoClaro,
  },
})
