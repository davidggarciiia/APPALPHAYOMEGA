import { useEffect, useId, useMemo, useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from "react-native-svg"

import { CURVA, useEstadoMovimiento } from "../componentes/movimiento"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { tema } from "../tema"

export type Punto = { fecha: string; valor: number }

const ALTO = 140
const MARGEN = 8
const Trazo = Animated.createAnimatedComponent(Path)
const PuntoFinal = Animated.createAnimatedComponent(Circle)

/** Trazo y área comparten un único reloj en el hilo de UI. */
export function Grafica({
  puntos,
  tendencia,
  descripcion,
  izquierda,
  derecha,
  animar = false,
}: {
  puntos: Punto[]
  tendencia: Punto[]
  descripcion: string
  izquierda: string
  derecha: string
  animar?: boolean
}): React.JSX.Element | null {
  const [ancho, setAncho] = useState(0)
  const { reducido, listo } = useEstadoMovimiento()
  const progreso = useSharedValue(0)
  const id = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const dibujo = useMemo(() => {
    const valores = [...puntos, ...tendencia].map((p) => p.valor)
    const min = Math.min(...valores)
    const max = Math.max(...valores)
    const fechas = [...new Set([...puntos, ...tendencia].map((p) => p.fecha))].sort()
    const primera = Date.parse(fechas[0] ?? "")
    const ultima = Date.parse(fechas[fechas.length - 1] ?? "")
    const x = (fecha: string): number =>
      ultima === primera
        ? ancho / 2
        : MARGEN + ((Date.parse(fecha) - primera) / (ultima - primera)) * (ancho - 2 * MARGEN)
    const y = (valor: number): number =>
      max === min ? ALTO / 2 : MARGEN + (1 - (valor - min) / (max - min)) * (ALTO - 2 * MARGEN)
    const linea = (tendencia.length > 1 ? tendencia : puntos).map((p) => ({
      x: x(p.fecha),
      y: y(p.valor),
    }))
    const trazo = linea.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")
    let longitud = 0
    for (let i = 1; i < linea.length; i++) {
      const anterior = linea[i - 1]!
      const actual = linea[i]!
      longitud += Math.hypot(actual.x - anterior.x, actual.y - anterior.y)
    }
    const principio = linea[0]
    const final = linea.at(-1)
    return {
      trazo,
      area: principio && final ? `${trazo} L${final.x} ${ALTO} L${principio.x} ${ALTO} Z` : "",
      longitud,
      final,
      fechas: Array.from({ length: 5 }, (_, i) =>
        fechas.length > 1
          ? new Date(primera + ((ultima - primera) * i) / 4).toISOString().slice(0, 10)
          : (fechas[0] ?? ""),
      ),
    }
  }, [puntos, tendencia, ancho])

  useEffect(() => {
    cancelAnimation(progreso)
    if (!listo || ancho <= 0 || puntos.length < 2) return
    progreso.value = reducido || !animar ? 1 : 0
    if (!reducido && animar)
      progreso.value = withTiming(1, { duration: 900, easing: CURVA.entrada })
    return () => cancelAnimation(progreso)
  }, [dibujo.trazo, ancho, puntos.length, listo, reducido, animar, progreso])

  const longitud = dibujo.longitud
  const trazoAnimado = useAnimatedProps(() => ({
    strokeDashoffset: longitud * (1 - progreso.value),
  }))
  const areaAnimada = useAnimatedProps(() => ({ opacity: progreso.value }))
  const finalAnimado = useAnimatedProps(() => ({ opacity: progreso.value >= 1 ? 1 : 0 }))

  if (puntos.length < 2) return null
  return (
    <View style={s.contenedor}>
      <View
        style={s.lienzo}
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={descripcion}
      >
        {ancho > 0 && dibujo.final && (
          <View aria-hidden>
            <Svg width={ancho} height={ALTO}>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tema.acento} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={tema.acento} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {[0.25, 0.5, 0.75].map((fraccion) => (
                <Line
                  key={fraccion}
                  x1={0}
                  x2={ancho}
                  y1={ALTO * fraccion}
                  y2={ALTO * fraccion}
                  stroke={tema.borde}
                  strokeWidth={1}
                />
              ))}
              <Trazo d={dibujo.area} fill={`url(#${id})`} animatedProps={areaAnimada} />
              <Trazo
                d={dibujo.trazo}
                fill="none"
                stroke={tema.acento}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={[dibujo.longitud]}
                animatedProps={trazoAnimado}
              />
              <PuntoFinal
                cx={dibujo.final.x}
                cy={dibujo.final.y}
                r={7}
                fill={tema.superficie}
                stroke={tema.acento}
                strokeWidth={2}
                animatedProps={finalAnimado}
              />
              <PuntoFinal
                cx={dibujo.final.x}
                cy={dibujo.final.y}
                r={3}
                fill={tema.acento}
                animatedProps={finalAnimado}
              />
            </Svg>
          </View>
        )}
      </View>
      <View style={s.pie} accessible={false}>
        {dibujo.fechas.map((fecha, i) => (
          <Text
            key={i}
            testID="grafica-fecha"
            style={s.etiqueta}
            accessibilityLabel={i === 0 ? izquierda : i === 4 ? derecha : fechaCorta(fecha)}
          >
            {fechaCorta(fecha)}
          </Text>
        ))}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 8, width: "100%", maxWidth: 330, alignSelf: "center" },
  lienzo: { height: ALTO },
  pie: { flexDirection: "row", justifyContent: "space-between" },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
})
