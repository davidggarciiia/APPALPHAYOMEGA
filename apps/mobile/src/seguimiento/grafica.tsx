import { useState } from "react"
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native"
import Svg, { Circle, Line, Polyline } from "react-native-svg"

import { tema } from "../tema"

export type Punto = { fecha: string; valor: number }

const ALTO = 110
const MARGEN = 8
/** Hueco a la izquierda para los valores del eje: «112,1 kg» cabe con letra de 11. */
const EJE = 56

/**
 * La gráfica de «Progreso»: un punto por día en gris, la tendencia en dorado y
 * el último punto destacado con un halo. Con `formato`, el eje vertical lleva
 * el valor más alto y el más bajo con su unidad y una guía fina en cada uno.
 * El resumen para lectores de pantalla va aparte.
 */
export function Grafica({
  puntos,
  tendencia,
  descripcion,
  izquierda,
  derecha,
  formato,
}: {
  puntos: Punto[]
  tendencia: Punto[]
  /** Lo que dice la gráfica, en texto. */
  descripcion: string
  izquierda: string
  derecha: string
  /** «112,1 kg»: los valores del eje con su unidad. */
  formato?: (valor: number) => string
}): React.JSX.Element {
  const [ancho, setAncho] = useState(0)
  const valores = [...puntos, ...tendencia].map((p) => p.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const eje = formato ? EJE : 0
  const fechas = [...new Set([...puntos, ...tendencia].map((p) => p.fecha))].sort()
  const primera = Date.parse(fechas[0] ?? "")
  const ultima = Date.parse(fechas[fechas.length - 1] ?? "")
  const x = (fecha: string): number =>
    ultima === primera
      ? eje + (ancho - eje) / 2
      : eje +
        MARGEN +
        ((Date.parse(fecha) - primera) / (ultima - primera)) * (ancho - eje - 2 * MARGEN)
  const y = (valor: number): number =>
    max === min ? ALTO / 2 : MARGEN + (1 - (valor - min) / (max - min)) * (ALTO - 2 * MARGEN)
  const ultimo = puntos[puntos.length - 1]
  const guias = max === min ? [max] : [max, min]
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
              {formato &&
                guias.map((valor) => (
                  <Line
                    key={valor}
                    x1={eje}
                    x2={ancho}
                    y1={y(valor)}
                    y2={y(valor)}
                    stroke={tema.borde}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))}
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
              {ultimo && (
                <Circle
                  cx={x(ultimo.fecha)}
                  cy={y(ultimo.valor)}
                  r={11}
                  fill={tema.acento}
                  fillOpacity={0.22}
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
            {formato &&
              guias.map((valor) => (
                <Text key={valor} style={[s.valorEje, { top: y(valor) - 8 }]} numberOfLines={1}>
                  {formato(valor)}
                </Text>
              ))}
          </View>
        )}
      </View>
      <View style={[s.pie, { paddingLeft: eje }]} accessible={false}>
        <Text style={s.etiqueta}>{izquierda}</Text>
        <Text style={[s.etiqueta, s.reciente]}>{derecha}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 8 },
  lienzo: { height: ALTO },
  valorEje: {
    position: "absolute",
    left: 0,
    width: EJE - 6,
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 11,
    lineHeight: 16,
  },
  pie: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  etiqueta: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  reciente: { color: tema.acento, fontFamily: tema.fuenteSemi, textAlign: "right" },
})
