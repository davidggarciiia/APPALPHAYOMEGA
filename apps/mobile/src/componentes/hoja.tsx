import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { alto, espacio, radio, tema, tipo } from "../tema"
import { CURVA, HOJA, useMovimientoReducido } from "./movimiento"

export function Hoja({
  visible,
  alCerrar,
  titulo,
  children,
}: {
  visible: boolean
  alCerrar: () => void
  titulo?: string
  children: ReactNode
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const [montada, fijarMontada] = useState(visible)
  const contenido = useRef(children)
  useEffect(() => {
    if (visible) contenido.current = children
  }, [children, visible])
  const anterior = useRef({ visible: false, reducido: true })
  const y = useSharedValue(height)
  const opacidad = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(y)
    cancelAnimation(opacidad)
    if (visible) fijarMontada(true)
    if (visible && !reducido && (!anterior.current.visible || anterior.current.reducido)) {
      y.value = height
      opacidad.value = 0
    }
    anterior.current = { visible, reducido }
    y.value = reducido
      ? visible
        ? 0
        : height
      : visible
        ? withSpring(0, HOJA)
        : withTiming(height, { duration: 200, easing: CURVA.salida })
    opacidad.value = reducido ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, { duration: 200 })
    const salida = !visible
      ? setTimeout(
          () => {
            contenido.current = null
            fijarMontada(false)
          },
          reducido ? 0 : 200,
        )
      : undefined
    return () => {
      cancelAnimation(y)
      cancelAnimation(opacidad)
      if (salida !== undefined) clearTimeout(salida)
    }
  }, [visible, reducido, height, y, opacidad])
  const hoja = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
  const scrim = useAnimatedStyle(() => ({ opacity: opacidad.value }))
  return (
    <Modal
      testID="hoja-modal"
      visible={montada}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => {
        if (visible) alCerrar()
      }}
    >
      <KeyboardAvoidingView
        testID="hoja-esquiva-teclado"
        style={s.modal}
        accessibilityViewIsModal
        pointerEvents={visible ? "auto" : "none"}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Animated.View style={[s.fondo, scrim]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cerrar hoja"
            onPress={alCerrar}
          />
        </Animated.View>
        <Animated.View
          testID="hoja-contenido"
          style={[
            s.hoja,
            {
              maxHeight: height - insets.top - espacio[20],
              paddingBottom: espacio[28] + insets.bottom,
            },
            hoja,
          ]}
        >
          <View style={s.asa} accessible={false} />
          <View style={s.cabecera}>
            {titulo ? (
              <Text accessibilityRole="header" style={s.titulo}>
                {titulo}
              </Text>
            ) : (
              <View style={s.flexible} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={s.cerrar}
              onPress={alCerrar}
            >
              <Text aria-hidden style={s.cruz}>
                ×
              </Text>
            </Pressable>
          </View>
          <ScrollView
            testID="hoja-scroll"
            style={s.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {visible ? children : contenido.current}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end" },
  fondo: { ...StyleSheet.absoluteFill, backgroundColor: tema.scrim },
  hoja: {
    flexShrink: 1,
    borderTopLeftRadius: radio.hoja,
    borderTopRightRadius: radio.hoja,
    borderTopWidth: 1,
    borderColor: tema.bordeDestacado,
    backgroundColor: tema.superficie,
    paddingTop: espacio[12],
    paddingHorizontal: espacio[20],
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  asa: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tema.bordeFuerte,
    alignSelf: "center",
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
    marginBottom: espacio[12],
  },
  titulo: { ...tipo.titulo, flex: 1, color: tema.texto },
  flexible: { flex: 1 },
  cerrar: {
    width: alto.tactil,
    height: alto.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
  cruz: { color: tema.texto, fontSize: 28, lineHeight: 32 },
})
