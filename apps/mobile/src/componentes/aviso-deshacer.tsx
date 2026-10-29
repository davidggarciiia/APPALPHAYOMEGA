import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { alto, espacio, radio, tema } from "../tema"
import { CURVA, DURACION, useMovimientoReducido } from "./movimiento"

const PLAZO = 5000

/** El contenedor de la pantalla lo coloca sobre la barra de ajuste. */
export function AvisoDeshacer({
  mensaje,
  alDeshacer,
  alExpirar,
  visible = true,
  id,
  animar = true,
  animarPlazo = true,
}: {
  mensaje: string
  alDeshacer: () => void
  alExpirar?: () => void
  visible?: boolean
  /** Identifica otra operación cuando se repite el mismo mensaje. */
  id?: string | number
  /** Permite reservar el movimiento para otra operación de la pantalla. */
  animar?: boolean
  /** La línea puede avanzar por segundos mientras otro componente interpola. */
  animarPlazo?: boolean
}): React.JSX.Element | null {
  const reducido = useMovimientoReducido()
  const estatico = reducido || !animar
  const plazoDiscreto = estatico || !animarPlazo
  const [fase, fijarFase] = useState<"activa" | "saliendo" | "oculta">(
    visible ? "activa" : "oculta",
  )
  const inicio = useRef(Date.now())
  const resuelta = useRef(false)
  const callbacks = useRef({ alDeshacer, alExpirar })
  callbacks.current = { alDeshacer, alExpirar }
  const plazo = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avance = useSharedValue(1)
  const apertura = useSharedValue(estatico ? 1 : 0)

  useEffect(() => {
    resuelta.current = false
    inicio.current = Date.now()
    fijarFase(visible ? "activa" : "oculta")
    if (visible)
      plazo.current = setTimeout(() => {
        if (resuelta.current) return
        resuelta.current = true
        fijarFase("saliendo")
        callbacks.current.alExpirar?.()
      }, PLAZO)
    return () => {
      if (plazo.current !== null) clearTimeout(plazo.current)
    }
  }, [mensaje, visible, id])

  useEffect(() => {
    cancelAnimation(avance)
    if (fase !== "activa") return
    const actualizar = (): void => {
      avance.value = Math.max(0, 1 - (Date.now() - inicio.current) / PLAZO)
    }
    actualizar()
    if (!plazoDiscreto)
      avance.value = withTiming(0, {
        duration: Math.max(0, PLAZO - (Date.now() - inicio.current)),
        easing: Easing.linear,
      })
    const intervalo = plazoDiscreto ? setInterval(actualizar, 1000) : undefined
    return () => {
      cancelAnimation(avance)
      if (intervalo !== undefined) clearInterval(intervalo)
    }
  }, [fase, plazoDiscreto, mensaje, id, avance])

  useEffect(() => {
    cancelAnimation(apertura)
    const entrando = fase === "activa"
    if (entrando && !estatico) apertura.value = 0
    apertura.value = estatico
      ? entrando
        ? 1
        : 0
      : withTiming(entrando ? 1 : 0, {
          duration: entrando ? DURACION.normal : 160,
          easing: entrando ? CURVA.entrada : CURVA.salida,
        })
    const salida =
      fase === "saliendo" ? setTimeout(() => fijarFase("oculta"), estatico ? 0 : 160) : undefined
    return () => {
      cancelAnimation(apertura)
      if (salida !== undefined) clearTimeout(salida)
    }
  }, [fase, estatico, apertura])

  const entrada = useAnimatedStyle(() => ({
    opacity: apertura.value,
    transform: [{ translateY: estatico ? 0 : 24 * (1 - apertura.value) }],
  }))
  const linea = useAnimatedStyle(() => ({ transform: [{ scaleX: avance.value }] }))
  if (!visible || fase === "oculta") return null
  return (
    <Animated.View style={[s.aviso, entrada]} accessibilityLiveRegion="polite">
      <View style={s.fila}>
        <Text style={s.texto}>{mensaje}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Deshacer"
          accessibilityState={{ disabled: fase !== "activa" }}
          disabled={fase !== "activa"}
          style={s.enlace}
          onPress={() => {
            if (resuelta.current) return
            resuelta.current = true
            if (plazo.current !== null) clearTimeout(plazo.current)
            fijarFase("saliendo")
            callbacks.current.alDeshacer()
          }}
        >
          <Text style={s.deshacer}>DESHACER</Text>
        </Pressable>
      </View>
      <Animated.View
        testID="aviso-deshacer-plazo"
        style={[s.linea, linea]}
        pointerEvents="none"
        accessible={false}
      />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  aviso: {
    minHeight: 56,
    backgroundColor: tema.superficieAlta,
    borderColor: tema.bordeDestacado,
    borderWidth: 1,
    borderRadius: radio.tarjetaInterna,
    overflow: "hidden",
  },
  fila: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
    paddingHorizontal: espacio[16],
  },
  texto: { flex: 1, color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 20 },
  enlace: { minHeight: alto.tactil, justifyContent: "center" },
  deshacer: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 12 },
  linea: { height: 3, backgroundColor: tema.acento, transformOrigin: "left center" },
})
