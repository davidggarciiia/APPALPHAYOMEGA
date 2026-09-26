import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg"

import { degradados, fuentes, tema } from "../tema"

import { Pulsable } from "./pulsable"

/*
 * Piezas del diseño de Claude Design (docs/diseno/pantallas): el brillo dorado
 * del fondo, los botones con degradado, la barra de progreso y la marca verde
 * de lo hecho. Las pantallas nuevas se construyen con esto.
 */

/** Degradado a 135°: de arriba a la izquierda a abajo a la derecha. */
const DIAGONAL = { inicio: { x: 0, y: 0 }, fin: { x: 1, y: 1 } } as const

/** El brillo cálido arriba a la derecha de cada pantalla. Va detrás de todo. */
export function BrilloDeFondo(): React.JSX.Element {
  return (
    <View style={estilos.brillo} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="brillo" cx="85%" cy="0%" rx="133%" ry="100%">
            <Stop offset="0" stopColor="#3A2A0C" stopOpacity={1} />
            <Stop offset="0.62" stopColor={tema.fondo} stopOpacity={1} />
            <Stop offset="1" stopColor={tema.fondo} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#brillo)" />
      </Svg>
    </View>
  )
}

export function BotonAtras({ onPress }: { onPress: () => void }): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      style={estilos.atras}
      accessibilityRole="button"
      accessibilityLabel="Volver"
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 5l-7 7 7 7"
          stroke={tema.texto}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pulsable>
  )
}

export function BotonOro({
  texto,
  onPress,
  ocupado = false,
  compacto = false,
  desactivado = false,
}: {
  texto: string
  onPress: () => void
  ocupado?: boolean
  compacto?: boolean
  desactivado?: boolean
}): React.JSX.Element {
  const inactivo = ocupado || desactivado
  return (
    <Pulsable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityState={{ busy: ocupado, disabled: inactivo }}
      style={[compacto ? estilos.oroCompacto : estilos.oro, desactivado && estilos.apagado]}
    >
      <LinearGradient
        colors={degradados.oro}
        locations={degradados.paradas}
        start={DIAGONAL.inicio}
        end={DIAGONAL.fin}
        style={[StyleSheet.absoluteFill, { borderRadius: compacto ? 12 : 16 }]}
      />
      <Text style={compacto ? estilos.textoOroCompacto : estilos.textoOro}>
        {ocupado ? "…" : texto}
      </Text>
    </Pulsable>
  )
}

export function BotonSobrio({
  texto,
  onPress,
  ocupado = false,
  peligro = false,
}: {
  texto: string
  onPress: () => void
  ocupado?: boolean
  peligro?: boolean
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityState={{ busy: ocupado, disabled: ocupado }}
      style={[estilos.sobrio, peligro && estilos.sobrioPeligro]}
    >
      <Text style={[estilos.textoSobrio, peligro && estilos.textoPeligro]}>
        {ocupado ? "…" : texto}
      </Text>
    </Pulsable>
  )
}

export function EnlaceOro({
  texto,
  onPress,
}: {
  texto: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={estilos.enlace}
    >
      <Text style={estilos.textoEnlace}>{texto}</Text>
    </Pulsable>
  )
}

/** Barra fina con el relleno en degradado dorado. */
export function BarraDeProgreso({
  fraccion,
  alto = 6,
}: {
  fraccion: number
  alto?: number
}): React.JSX.Element {
  const ancho: `${number}%` = `${Math.round(Math.min(1, Math.max(0, fraccion)) * 100)}%`
  return (
    <View style={[estilos.pista, { height: alto, borderRadius: alto / 2 }]}>
      <LinearGradient
        colors={degradados.oro}
        locations={degradados.paradas}
        start={DIAGONAL.inicio}
        end={DIAGONAL.fin}
        style={{ width: ancho, height: alto, borderRadius: alto / 2 }}
      />
    </View>
  )
}

/** La marca de verificación del diseño. */
export function Visto({
  tamano = 18,
  color = tema.sobreVerde,
}: {
  tamano?: number
  color?: string
}): React.JSX.Element {
  // La vista de fuera no sobra: en web un <svg> suelto se pinta por debajo de un
  // relleno con posición absoluta aunque vaya después; una View (posicionada) no.
  return (
    <View>
      <Svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

/** Relleno verde de lo hecho, para poner dentro de un botón o una pastilla. */
export function RellenoVerde({ radio }: { radio: number }): React.JSX.Element {
  return (
    <LinearGradient
      colors={degradados.verde}
      locations={degradados.paradas}
      start={DIAGONAL.inicio}
      end={DIAGONAL.fin}
      style={[StyleSheet.absoluteFill, { borderRadius: radio }]}
    />
  )
}

export function Tarjeta({
  children,
  destacada = false,
  style,
}: {
  children: ReactNode
  destacada?: boolean
  style?: StyleProp<ViewStyle>
}): React.JSX.Element {
  return (
    <View style={[estilos.tarjeta, destacada && estilos.tarjetaDestacada, style]}>{children}</View>
  )
}

/** Tipografía del diseño. */
export const texto = StyleSheet.create({
  titulo: {
    color: tema.texto,
    fontFamily: fuentes.titulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  seccion: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 20, lineHeight: 25 },
  cuerpo: { color: tema.texto, fontFamily: fuentes.normal, fontSize: 15, lineHeight: 21 },
  fuerte: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 17 },
  tenue: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13, lineHeight: 18 },
  tenueGrande: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 15 },
  oro: { color: tema.oro, fontFamily: fuentes.negrita, fontSize: 15 },
})

const estilos = StyleSheet.create({
  brillo: { position: "absolute", top: 0, left: 0, right: 0, height: 560 },
  atras: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1F1D19",
    alignItems: "center",
    justifyContent: "center",
  },
  oro: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  oroCompacto: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  apagado: { opacity: 0.45 },
  textoOro: { color: tema.sobreOro, fontFamily: fuentes.negrita, fontSize: 17 },
  textoOroCompacto: { color: tema.sobreOro, fontFamily: fuentes.negrita, fontSize: 15 },
  sobrio: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
    alignSelf: "stretch",
  },
  sobrioPeligro: { borderWidth: 1, borderColor: tema.error },
  textoSobrio: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 17 },
  textoPeligro: { color: tema.error },
  enlace: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  textoEnlace: { color: tema.oro, fontFamily: fuentes.semi, fontSize: 15 },
  pista: { backgroundColor: tema.borde, overflow: "hidden" },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 16, gap: 10 },
  tarjetaDestacada: { borderWidth: 1, borderColor: tema.bordeOro },
})
