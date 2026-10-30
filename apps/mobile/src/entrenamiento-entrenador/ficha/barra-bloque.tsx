import { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
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
  const actual = semanaDelBloque(plan, lunes)
  const semanas = Array.from({ length: plan.semanas }, (_, i) => {
    const numero = i + 1
    const fase = faseDeSemana(plan.bloque?.fases ?? [], numero)
    const semanaNombrada = fase?.nombre.match(/^semana\s+(\d+)\s*(?:[·:–—-]\s*|$)/i)
    const semanaReal = semanaNombrada ? Number(semanaNombrada[1]) + numero - fase!.desde : numero
    const nombre =
      (semanaNombrada ? fase!.nombre.slice(semanaNombrada[0].length) : fase?.nombre)
        ?.trim()
        .replace(/\.+$/, "") || "Ajuste"
    const ajuste = fase?.ajustes ? nombre[0]!.toLocaleUpperCase("es") + nombre.slice(1) : null
    return { numero, semanaReal, ajuste }
  })
  useEffect(() => {
    cancelAnimation(relleno)
    if (reducido || pausada) {
      relleno.value = 1
      if (pausada) iniciada.current = true
    } else {
      if (!iniciada.current) {
        relleno.value = 0
        relleno.value = withTiming(1, { duration: 400, easing: CURVA.entrada })
        iniciada.current = true
      }
    }
    return () => {
      cancelAnimation(relleno)
    }
  }, [reducido, pausada, relleno])
  const completado = useAnimatedStyle(() => ({ transform: [{ scaleX: relleno.value }] }))
  const ajustes = semanas.filter((semana) => semana.ajuste)
  const descripcion = ajustes
    .map(
      ({ semanaReal, ajuste }) =>
        `la semana ${semanaReal} es de ${ajuste!.toLocaleLowerCase("es")}`,
    )
    .join(" y ")

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Semana ${actual} de ${plan.semanas}.${descripcion ? ` ${descripcion[0]!.toLocaleUpperCase("es")}${descripcion.slice(1)}.` : ""}`}
      accessibilityValue={{ min: 1, max: plan.semanas, now: actual }}
      style={s.barra}
    >
      {semanas.map(({ numero, semanaReal, ajuste }) => {
        const mostrarEtiqueta =
          plan.semanas <= 12 && (plan.semanas <= 8 || numero === actual || ajuste)
        return (
          <View key={numero} style={s.semana}>
            <View style={[s.segmento, ajuste && s.ajuste]} testID={`bloque-semana-${numero}`}>
              {numero < actual && !ajuste && (
                <Animated.View style={[s.relleno, degradadoOro, completado]} />
              )}
              {numero === actual && <View style={[s.relleno, s.actual]} />}
            </View>
            {mostrarEtiqueta && (
              <Text
                style={[
                  s.etiqueta,
                  ajuste && s.etiquetaAjuste,
                  numero === actual && s.etiquetaActual,
                ]}
              >
                {`S${semanaReal}${ajuste ? ` · ${ajuste}` : ""}`}
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
