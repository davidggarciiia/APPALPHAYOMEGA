import { useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Svg, { Circle, Polyline } from "react-native-svg"

import { tema } from "../tema"

export type Punto = { fecha: string; valor: number }

const ALTO = 110
const MARGEN = 8

/**
 * La gráfica de «Progreso»: un punto por día en gris, la tendencia en dorado y
 * el último punto destacado. El resumen para lectores de pantalla va aparte.
 */
export function Grafica({
  puntos,
  tendencia,
  descripcion,
  izquierda,
  derecha,
}: {
  puntos: Punto[]
  tendencia: Punto[]
  /** Lo que dice la gráfica, en texto. */
  descripcion: string
  izquierda: string
  derecha: string
}): React.JSX.Element {
  const [ancho, setAncho] = useState(0)
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
  const ultimo = puntos[puntos.length - 1]
  return (
    <View style={s.contenedor}>
      <View
        style={s.lienzo}
        onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="image"
        accessibilityLabel={descripcion}
      >
        {ancho > 0 && valores.length > 0 && (
          <View aria-hidden>
            <Svg width={ancho} height={ALTO}>
              {tendencia.length > 1 && (
                <Polyline
                  points={tendencia.map((p) => `${x(p.fecha)},${y(p.valor)}`).join(" ")}
                  fill="none"
                  stroke={tema.acento}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {puntos.map((p) => (
                <Circle
                  key={p.fecha}
                  cx={x(p.fecha)}
                  cy={y(p.valor)}
                  r={p === ultimo ? 5.5 : 3.5}
                  fill={p === ultimo ? tema.acento : tema.marcador}
                />
              ))}
            </Svg>
          </View>
        )}
      </View>
      <View style={s.pie} accessible={false}>
        <Text style={s.etiqueta}>{izquierda}</Text>
        <Text style={s.etiqueta}>{derecha}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 8 },
  lienzo: { height: ALTO },
  pie: { flexDirection: "row", justifyContent: "space-between" },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
})
