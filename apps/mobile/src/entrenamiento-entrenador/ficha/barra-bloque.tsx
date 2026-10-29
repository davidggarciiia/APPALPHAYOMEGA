import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { faseDeSemana, type PlanVigente } from "@alpha-omega/shared"

import { ANGULO, CURVA, useMovimientoReducido } from "../../componentes/movimiento"
import { semanaDelBloque } from "../../entrenamiento/plan/modelo"
import { degradadoOro, tema } from "../../tema"

export function BarraDeBloque({
  plan,
  lunes,
  pausada = false,
}: {
  plan: PlanVigente
  lunes: string
  pausada?: boolean
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const iniciada = useRef(false)
  const relleno = useSharedValue(1)
  const pulso = useSharedValue(1)
  const actual = semanaDelBloque(plan, lunes)
  const semanas = Array.from({ length: plan.semanas }, (_, i) => {
    const numero = i + 1
    const fase = faseDeSemana(plan.bloque?.fases ?? [], numero)
    return { numero, ajuste: fase?.ajustes ? fase.nombre.toLocaleLowerCase("es") : null }
  })
  useEffect(() => {
    cancelAnimation(relleno)
    cancelAnimation(pulso)
    if (reducido || pausada) {
      relleno.value = 1
      pulso.value = 1
      if (pausada) iniciada.current = true
    } else {
      if (!iniciada.current) {
        relleno.value = 0
        relleno.value = withTiming(1, { duration: 400, easing: CURVA.entrada })
        iniciada.current = true
      }
      pulso.value = withDelay(500, withRepeat(withTiming(0.45, { duration: 1400 }), -1, true))
    }
    return () => {
      cancelAnimation(relleno)
      cancelAnimation(pulso)
    }
  }, [reducido, pausada, relleno, pulso])
  const completado = useAnimatedStyle(() => ({ transform: [{ scaleX: relleno.value }] }))
  const encendido = useAnimatedStyle(() => ({ opacity: pulso.value }))
  const ajustes = semanas.filter((semana) => semana.ajuste)
  const descripcion = ajustes
    .map(({ numero, ajuste }) => `la semana ${numero} es de ${ajuste}`)
    .join(" y ")

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Semana ${actual} de ${plan.semanas}.${descripcion ? ` ${descripcion[0]!.toLocaleUpperCase("es")}${descripcion.slice(1)}.` : ""}`}
      accessibilityValue={{ min: 1, max: plan.semanas, now: actual }}
      style={s.barra}
    >
      {semanas.map(({ numero, ajuste }) => {
        const nombreCorto = ajuste && ajuste.length > 9 ? `${ajuste.slice(0, 8)}.` : ajuste
        const mostrarEtiqueta =
          plan.semanas <= 12 && (plan.semanas <= 8 || numero === actual || ajuste)
        return (
          <View key={numero} style={s.semana}>
            <View style={[s.segmento, ajuste && s.ajuste]} testID={`bloque-semana-${numero}`}>
              {numero < actual && !ajuste && (
                <Animated.View style={[s.relleno, degradadoOro, completado]} />
              )}
              {numero === actual && <Animated.View style={[s.relleno, s.actual, encendido]} />}
            </View>
            {mostrarEtiqueta && (
              <Text
                style={[
                  s.etiqueta,
                  ajuste && s.etiquetaAjuste,
                  numero === actual && s.etiquetaActual,
                ]}
              >
                {`S${numero}${nombreCorto ? ` ${nombreCorto}` : ""}`}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  barra: { flexDirection: "row", gap: 3 },
  semana: { flex: 1, minWidth: 0, gap: 8 },
  segmento: {
    height: 10,
    borderRadius: 2,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
    transform: [{ skewX: `-${ANGULO}deg` }],
  },
  ajuste: {
    borderColor: tema.aviso,
    borderStyle: "dashed",
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  relleno: { ...StyleSheet.absoluteFill, transformOrigin: "0% 50%" },
  actual: { backgroundColor: tema.acento },
  etiqueta: { fontFamily: tema.fuenteTexto, fontSize: 12, lineHeight: 16, color: tema.textoTenue },
  etiquetaAjuste: { color: tema.aviso },
  etiquetaActual: { color: tema.texto, fontFamily: tema.fuenteSemi },
})
