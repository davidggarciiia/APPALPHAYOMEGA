import { useEffect } from "react"
import { Pressable, StyleSheet, View } from "react-native"
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { alto, tema } from "../tema"
import { vibrar } from "./botones"
import { Icono, type NombreIcono } from "./iconos"
import { ANGULO, CURVA, INDICADOR, useMovimientoReducido } from "./movimiento"

type Destino = { clave: string; nombre: string; icono: NombreIcono }
const corte = 3 * Math.tan((ANGULO * Math.PI) / 180)

/** La selección pertenece al router; la barra solo representa y solicita el cambio. */
export function BarraPestanas({
  destinos,
  activa,
  alCambiar,
}: {
  destinos: Destino[]
  activa: string | null
  alCambiar: (clave: string) => void
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const indice = destinos.findIndex((d) => d.clave === activa)
  const posicion = useSharedValue(indice)
  const seleccion = useSharedValue(indice)
  const anterior = useSharedValue(indice)
  const tinte = useSharedValue(1)
  const ancho = useSharedValue(0)

  useEffect(() => {
    const cambia = seleccion.value !== indice
    anterior.value = seleccion.value
    seleccion.value = indice
    posicion.value = reducido || !cambia || indice < 0 ? indice : withSpring(indice, INDICADOR)
    tinte.value = reducido || !cambia ? 1 : 0
    if (!reducido && cambia) tinte.value = withTiming(1, { duration: 160, easing: CURVA.entrada })
    return () => {
      cancelAnimation(posicion)
      cancelAnimation(tinte)
    }
  }, [anterior, indice, posicion, reducido, seleccion, tinte])

  const indicador = useAnimatedStyle(() => ({
    opacity: indice < 0 || ancho.value === 0 ? 0 : 1,
    transform: [{ translateX: (posicion.value + 0.5) * (ancho.value / destinos.length) - 16 }],
  }))

  return (
    <View
      accessibilityRole="tablist"
      style={s.barra}
      onLayout={(evento) => {
        ancho.value = evento.nativeEvent.layout.width
      }}
    >
      <Animated.View
        style={[s.indicador, indicador]}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width={32} height={3} viewBox="0 0 32 3">
          <Path d={`M${corte} 0H32L${32 - corte} 3H0Z`} fill={tema.acento} />
        </Svg>
      </Animated.View>
      {destinos.map((destino, i) => (
        <Pestana
          key={destino.clave}
          destino={destino}
          indice={i}
          seleccion={seleccion}
          anterior={anterior}
          tinte={tinte}
          activa={indice === i}
          alPulsar={() => {
            vibrar("suave")
            alCambiar(destino.clave)
          }}
        />
      ))}
    </View>
  )
}

function Pestana({
  destino,
  indice,
  seleccion,
  anterior,
  tinte,
  activa,
  alPulsar,
}: {
  destino: Destino
  indice: number
  seleccion: SharedValue<number>
  anterior: SharedValue<number>
  tinte: SharedValue<number>
  activa: boolean
  alPulsar: () => void
}): React.JSX.Element {
  const intensidad = useDerivedValue(() =>
    seleccion.value === indice ? tinte.value : anterior.value === indice ? 1 - tinte.value : 0,
  )
  const texto = useAnimatedStyle(() => ({
    color: interpolateColor(intensidad.value, [0, 1], [tema.textoTenue, tema.acento]),
  }))
  const icono = useAnimatedStyle(() => ({
    opacity: intensidad.value,
  }))
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={destino.nombre}
      accessibilityState={{ selected: activa }}
      onPress={alPulsar}
      style={s.destino}
    >
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <Icono nombre={destino.icono} color={tema.textoTenue} />
        <Animated.View style={[StyleSheet.absoluteFill, icono]}>
          <Icono nombre={destino.icono} color={tema.acento} />
        </Animated.View>
      </View>
      <Animated.Text style={[s.etiqueta, texto]}>{destino.nombre}</Animated.Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  barra: { flexDirection: "row", minHeight: alto.barraPestanas, width: "100%" },
  indicador: { position: "absolute", top: 0, left: 0, width: 32, height: 3 },
  destino: {
    flex: 1,
    minHeight: alto.barraPestanas,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  etiqueta: { fontSize: 11, fontFamily: tema.fuenteSemi },
})
