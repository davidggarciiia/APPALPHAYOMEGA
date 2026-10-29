import { useEffect, useRef, useState } from "react"
import { StyleSheet, View, useWindowDimensions, type StyleProp, type TextStyle } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"

import { tema } from "../tema"
import { CURVA, useMovimientoReducido } from "./movimiento"

/** Un solo avance mueve todos los dígitos; mantener ± actualiza sin acumular giros. */
export function NumeroGiro({
  valor,
  estilo,
}: {
  valor: number | string
  estilo?: StyleProp<TextStyle>
}): React.JSX.Element {
  const texto = String(valor)
  const reducido = useMovimientoReducido()
  const { fontScale } = useWindowDimensions()
  const anterior = useRef(texto)
  const ultimoCambio = useRef(-Infinity)
  const [saliente, fijarSaliente] = useState<string | null>(null)
  const [direccion, fijarDireccion] = useState(1)
  const avance = useSharedValue(1)
  const formato = StyleSheet.flatten([estilos.texto, estilo])
  const alto = (formato.lineHeight ?? (formato.fontSize ?? 30) + 4) * fontScale
  const ancho = (formato.fontSize ?? 30) * 0.66 * fontScale

  useEffect(() => {
    if (texto === anterior.current) return
    const ahora = Date.now()
    const previo = anterior.current
    const rapido = ahora - ultimoCambio.current < 100
    anterior.current = texto
    ultimoCambio.current = ahora
    cancelAnimation(avance)
    if (reducido || rapido) {
      fijarSaliente(null)
      avance.value = 1
      return
    }
    fijarSaliente(previo)
    fijarDireccion(Number(texto.replace(",", ".")) >= Number(previo.replace(",", ".")) ? 1 : -1)
    avance.value = 0
    avance.value = withTiming(1, { duration: 140, easing: CURVA.entrada })
  }, [texto, reducido, avance])

  useEffect(() => {
    if (reducido) {
      cancelAnimation(avance)
      avance.value = 1
      fijarSaliente(null)
    }
    return () => cancelAnimation(avance)
  }, [reducido, avance])

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={texto} style={estilos.fila}>
      {Array.from(texto).map((caracter, i) => (
        <Digito
          key={i}
          actual={caracter}
          anterior={saliente === null ? undefined : (saliente[i] ?? "")}
          direccion={direccion}
          avance={avance}
          alto={alto}
          ancho={ancho}
          estilo={formato}
        />
      ))}
    </View>
  )
}

function Digito({
  actual,
  anterior,
  direccion,
  avance,
  alto,
  ancho,
  estilo,
}: {
  actual: string
  anterior?: string
  direccion: number
  avance: SharedValue<number>
  alto: number
  ancho: number
  estilo: TextStyle
}): React.JSX.Element {
  const cambia = anterior !== undefined && anterior !== actual
  const entra = useAnimatedStyle(() => ({
    transform: [{ translateY: cambia ? direccion * alto * (1 - avance.value) : 0 }],
  }))
  const sale = useAnimatedStyle(() => ({
    opacity: 1 - avance.value,
    transform: [{ translateY: -direccion * alto * avance.value }],
  }))
  return (
    <View
      style={{ width: ancho, height: alto, overflow: "hidden" }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {cambia && (
        <Animated.Text
          testID="numero-anterior"
          accessible={false}
          style={[estilo, estilos.digito, sale]}
        >
          {anterior}
        </Animated.Text>
      )}
      <Animated.Text accessible={false} style={[estilo, estilos.digito, entra]}>
        {actual}
      </Animated.Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", flexShrink: 1 },
  texto: {
    fontFamily: tema.fuenteTitulo,
    fontSize: 30,
    lineHeight: 34,
    color: tema.texto,
    fontVariant: ["tabular-nums"],
  },
  digito: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    minWidth: 0,
    minHeight: 0,
    textAlign: "center",
  },
})
