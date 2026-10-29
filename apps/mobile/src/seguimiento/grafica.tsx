import { useEffect, useId, useMemo, useRef, useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  Stop,
  Text as TextoSvg,
} from "react-native-svg"

import { CURVA, useEstadoMovimiento } from "../componentes/movimiento"
import { fechaCorta } from "../entrenamiento/plan/modelo"
import { tema } from "../tema"

export type Punto = { fecha: string; valor: number }

const ALTO = 140
const MARGEN = 8
const Trazo = Animated.createAnimatedComponent(Path)
const PuntoFinal = Animated.createAnimatedComponent(Circle)
const numero = (valor: number): string => Number(valor.toFixed(1)).toString().replace(".", ",")

/** Trazo y área comparten un único reloj en el hilo de UI. */
export function Grafica({
  puntos,
  tendencia,
  comparacion,
  descripcion,
  izquierda,
  derecha,
  animar = false,
}: {
  puntos: Punto[]
  tendencia: Punto[]
  comparacion?: Punto[]
  descripcion: string
  izquierda: string
  derecha: string
  animar?: boolean
}): React.JSX.Element | null {
  const [ancho, setAncho] = useState(0)
  const { reducido, listo } = useEstadoMovimiento()
  const progreso = useSharedValue(0)
  const opacidadComparacion = useSharedValue(0)
  const ultimaAnimacion = useRef("")
  const alto = comparacion ? 156 : ALTO
  const id = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const dibujo = useMemo(() => {
    const series = [...puntos, ...(comparacion ?? tendencia)]
    const valores = series.map((p) => p.valor)
    const minimo = Math.min(...valores)
    const maximo = Math.max(...valores)
    const rango = Math.max((maximo - minimo) / 3, 0.1)
    const base = 10 ** Math.floor(Math.log10(rango))
    const paso = ([1, 2, 5, 10].find((n) => n * base >= rango) ?? 10) * base
    const min = comparacion ? Math.floor(minimo / paso) * paso : minimo
    const max = comparacion ? Math.ceil(maximo / paso) * paso : maximo
    const marcas =
      comparacion && Number.isFinite(min)
        ? Array.from({ length: Math.round((max - min) / paso) + 1 }, (_, i) => min + i * paso)
        : []
    const fechas = [...new Set(series.map((p) => p.fecha))].sort()
    const primera = Date.parse(fechas[0] ?? "")
    const ultima = Date.parse(fechas[fechas.length - 1] ?? "")
    const x = (fecha: string): number =>
      ultima === primera
        ? ancho / 2
        : (comparacion ? 30 : MARGEN) +
          ((Date.parse(fecha) - primera) / (ultima - primera)) *
            (ancho - (comparacion ? 42 : 2 * MARGEN))
    const y = (valor: number): number =>
      max === min ? alto / 2 : MARGEN + (1 - (valor - min) / (max - min)) * (alto - 2 * MARGEN)
    const linea = (comparacion ? puntos : tendencia.length > 1 ? tendencia : puntos).map((p) => ({
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
      trazoComparacion:
        comparacion?.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.fecha)} ${y(p.valor)}`).join(" ") ??
        "",
      area: principio && final ? `${trazo} L${final.x} ${alto} L${principio.x} ${alto} Z` : "",
      longitud,
      final,
      marcas: marcas.map((valor) => ({ valor, y: y(valor) })),
      fechas: comparacion
        ? fechas.filter(
            (_, i) =>
              fechas.length <= 5 ||
              [0, 1, 2, 3, 4].some((n) => i === Math.round((n * (fechas.length - 1)) / 4)),
          )
        : Array.from({ length: 5 }, (_, i) =>
            fechas.length > 1
              ? new Date(primera + ((ultima - primera) * i) / 4).toISOString().slice(0, 10)
              : (fechas[0] ?? ""),
          ),
    }
  }, [puntos, tendencia, comparacion, alto, ancho])

  useEffect(() => {
    if (!listo || ancho <= 0 || puntos.length < 2) return
    const clave = `${dibujo.trazo}|${dibujo.trazoComparacion}|${reducido}|${animar}`
    if (ultimaAnimacion.current === clave) return
    ultimaAnimacion.current = clave
    cancelAnimation(progreso)
    cancelAnimation(opacidadComparacion)
    progreso.value = reducido || !animar ? 1 : 0
    opacidadComparacion.value = reducido || !animar ? 1 : 0
    if (!reducido && animar) {
      progreso.value = withTiming(1, { duration: 900, easing: CURVA.entrada })
      if (comparacion)
        opacidadComparacion.value = withTiming(1, { duration: 200, easing: CURVA.entrada })
    }
  }, [
    dibujo.trazo,
    dibujo.trazoComparacion,
    ancho,
    puntos.length,
    listo,
    reducido,
    animar,
    progreso,
    comparacion,
    opacidadComparacion,
  ])

  useEffect(
    () => () => {
      cancelAnimation(progreso)
      cancelAnimation(opacidadComparacion)
    },
    [progreso, opacidadComparacion],
  )

  const longitud = dibujo.longitud
  const trazoAnimado = useAnimatedProps(() => ({
    strokeDashoffset: longitud * (1 - progreso.value),
  }))
  const areaAnimada = useAnimatedProps(() => ({ opacity: progreso.value }))
  const finalAnimado = useAnimatedProps(() => ({ opacity: progreso.value >= 1 ? 1 : 0 }))
  const comparacionAnimada = useAnimatedProps(() => ({ opacity: opacidadComparacion.value }))

  if (puntos.length < 2) return null
  return (
    <View style={s.contenedor}>
      <View
        style={{ height: alto }}
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={descripcion}
      >
        {ancho > 0 && dibujo.final && (
          <View aria-hidden>
            <Svg width={ancho} height={alto}>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={tema.acento} stopOpacity={0.18} />
                  <Stop offset="1" stopColor={tema.acento} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {comparacion
                ? dibujo.marcas.map((marca) => (
                    <G key={marca.valor}>
                      <Line
                        x1={30}
                        x2={ancho}
                        y1={marca.y}
                        y2={marca.y}
                        stroke={tema.borde}
                        strokeWidth={1}
                      />
                      <TextoSvg
                        testID="grafica-eje-kg"
                        x={0}
                        y={marca.y + 4}
                        fontSize={11}
                        fontFamily={tema.fuenteTexto}
                        fill={tema.textoTenue}
                      >
                        {numero(marca.valor)}
                      </TextoSvg>
                    </G>
                  ))
                : [0.25, 0.5, 0.75].map((fraccion) => (
                    <Line
                      key={fraccion}
                      x1={0}
                      x2={ancho}
                      y1={alto * fraccion}
                      y2={alto * fraccion}
                      stroke={tema.borde}
                      strokeWidth={1}
                    />
                  ))}
              {!comparacion && (
                <Trazo d={dibujo.area} fill={`url(#${id})`} animatedProps={areaAnimada} />
              )}
              {comparacion && (
                <Trazo
                  testID="grafica-comparacion"
                  d={dibujo.trazoComparacion}
                  fill="none"
                  stroke={tema.textoTenue}
                  strokeWidth={2}
                  strokeDasharray={[5, 5]}
                  animatedProps={comparacionAnimada}
                />
              )}
              <Trazo
                testID="grafica-linea"
                d={dibujo.trazo}
                fill="none"
                stroke={tema.acento}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={[dibujo.longitud]}
                animatedProps={trazoAnimado}
              />
              {comparacion && (
                <PuntoFinal
                  cx={dibujo.final.x}
                  cy={dibujo.final.y}
                  r={11}
                  fill={tema.acento}
                  fillOpacity={0.14}
                  animatedProps={finalAnimado}
                />
              )}
              <PuntoFinal
                cx={dibujo.final.x}
                cy={dibujo.final.y}
                r={7}
                fill={tema.superficie}
                stroke={tema.acento}
                strokeWidth={2}
                animatedProps={finalAnimado}
              />
              {comparacion && (
                <TextoSvg
                  testID="grafica-valor-final"
                  x={dibujo.final.x - 10}
                  y={Math.max(14, dibujo.final.y - 12)}
                  textAnchor="end"
                  fontFamily={tema.fuenteTexto}
                  fontSize={12}
                  fill={tema.acento}
                >
                  {numero(puntos.at(-1)!.valor)}
                </TextoSvg>
              )}
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
            accessibilityLabel={
              i === 0 ? izquierda : i === dibujo.fechas.length - 1 ? derecha : fechaCorta(fecha)
            }
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
  pie: { flexDirection: "row", justifyContent: "space-between" },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
})
