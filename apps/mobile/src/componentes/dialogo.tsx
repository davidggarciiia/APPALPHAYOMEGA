import { useEffect, useRef, type ReactNode } from "react"
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { espacio, radio, tema, tipo } from "../tema"
import { BotonDestructivo, BotonPrincipal, BotonSecundario } from "./botones"
import { CURVA, useMovimientoReducido } from "./movimiento"

/** La operación ocupada también bloquea la salida por Android. */
export function Dialogo({
  visible,
  titulo,
  texto,
  confirmar,
  cancelar,
  alConfirmar,
  alCancelar,
  peligro = false,
  ocupado = false,
  children,
}: {
  visible: boolean
  titulo: string
  texto: string
  confirmar: string
  cancelar: string
  alConfirmar: () => void
  alCancelar: () => void
  peligro?: boolean
  ocupado?: boolean
  children?: ReactNode
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const apertura = useSharedValue(0)
  const fondo = useSharedValue(0)
  const anteriorVisible = useRef(false)
  useEffect(() => {
    cancelAnimation(apertura)
    cancelAnimation(fondo)
    const animar = visible && !reducido && !anteriorVisible.current
    anteriorVisible.current = visible
    if (animar) {
      apertura.value = 0
      fondo.value = 0
    }
    apertura.value = !animar
      ? visible
        ? 1
        : 0
      : withTiming(1, { duration: 180, easing: CURVA.entrada })
    fondo.value = !animar ? (visible ? 1 : 0) : withTiming(1, { duration: 160 })
    return () => {
      cancelAnimation(apertura)
      cancelAnimation(fondo)
    }
  }, [visible, reducido, apertura, fondo])
  const cuerpo = useAnimatedStyle(() => ({
    opacity: apertura.value,
    transform: [{ scale: reducido ? 1 : 0.96 + 0.04 * apertura.value }],
  }))
  const scrim = useAnimatedStyle(() => ({ opacity: fondo.value }))
  const Confirmar = peligro ? BotonDestructivo : BotonPrincipal
  return (
    <Modal
      testID="dialogo-modal"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={ocupado ? () => undefined : alCancelar}
    >
      <Animated.View pointerEvents="none" style={[s.scrim, scrim]} />
      <KeyboardAvoidingView
        testID="dialogo-esquiva-teclado"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.velo}
      >
        <Animated.View accessibilityViewIsModal style={[s.dialogo, cuerpo]}>
          <Text accessibilityRole="header" style={s.titulo}>
            {titulo}
          </Text>
          <Text style={s.texto}>{texto}</Text>
          {children}
          <Confirmar texto={confirmar} onPress={alConfirmar} ocupado={ocupado} sinMargen />
          <BotonSecundario
            texto={cancelar}
            onPress={alCancelar}
            deshabilitado={ocupado}
            sinMargen
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: tema.scrim },
  velo: { flex: 1, justifyContent: "center", padding: espacio[20] },
  dialogo: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    paddingTop: 22,
    paddingHorizontal: espacio[20],
    paddingBottom: espacio[16],
    gap: espacio[12],
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    lineHeight: 28,
    textTransform: "uppercase",
  },
  texto: { ...tipo.cuerpo, color: tema.textoTenue },
})
