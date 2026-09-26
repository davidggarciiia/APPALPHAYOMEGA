import { useEffect, useState, type ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, { css, cubicBezier } from "react-native-reanimated"

import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { degradadoOro, tema } from "../tema"

/** Salida fuerte: lo que entra arranca deprisa, que es cuando se está mirando. */
const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/** Entre tarjeta y tarjeta: menos se lee como a la vez; más, como lento. */
const ESCALON_MS = 40

const entradas = css.create({
  // Sube 8 puntos y aparece. Nunca desde la nada: desde casi su sitio.
  subir: {
    animationName: css.keyframes({
      from: { opacity: 0, transform: [{ translateY: 8 }] },
      to: { opacity: 1, transform: [{ translateY: 0 }] },
    }),
    animationDuration: 250,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
  // Movimiento reducido: el mismo aviso de que algo llega, sin desplazarlo.
  fundir: {
    animationName: css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }),
    animationDuration: 200,
    animationTimingFunction: SALIDA,
    animationFillMode: "both",
  },
})

export type Entrada = "subir" | "fundir" | null

/**
 * Una cifra del día: «ENTRENOS HOY · 8 · 3 enviados». Se lee entera como una
 * sola frase para el lector de pantalla.
 */
export function Indicador({
  etiqueta,
  cifra,
  detalle,
  destacada = false,
  color = tema.texto,
  entrada,
  orden,
}: {
  etiqueta: string
  cifra: string
  detalle: string
  /** Pide atención: borde dorado. */
  destacada?: boolean
  color?: string
  entrada: Entrada
  orden: number
}): React.JSX.Element {
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${etiqueta}: ${cifra}. ${detalle}`}
      style={[
        s.indicador,
        destacada && s.destacada,
        entrada && [entradas[entrada], { animationDelay: orden * ESCALON_MS }],
      ]}
    >
      <Text style={s.etiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text style={[s.cifra, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {cifra}
      </Text>
      <Text style={s.detalleIndicador} numberOfLines={2}>
        {detalle}
      </Text>
    </Animated.View>
  )
}

/** Título de bloque en Anton, con la cuenta o el rango a la derecha. */
export function Seccion({
  titulo,
  derecha,
  children,
}: {
  titulo: string
  derecha?: string | null
  children: ReactNode
}): React.JSX.Element {
  return (
    <View style={s.seccion}>
      <View style={s.cabeceraSeccion}>
        <Text style={s.tituloSeccion} accessibilityRole="header">
          {titulo}
        </Text>
        {derecha ? <Text style={s.derecha}>{derecha}</Text> : null}
      </View>
      {children}
    </View>
  )
}

export function Tarjeta({ children }: { children: ReactNode }): React.JSX.Element {
  return <View style={s.tarjeta}>{children}</View>
}

/**
 * Una fila que abre su destino: la sesión, la ficha o una sección. El nombre
 * accesible dice qué es y adónde lleva; la flecha es decorativa.
 */
export function FilaPulsable({
  etiqueta,
  primera = false,
  onPress,
  children,
}: {
  etiqueta: string
  primera?: boolean
  onPress: () => void
  children: ReactNode
}): React.JSX.Element {
  return (
    <Pulsable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={[s.fila, !primera && s.separada]}
    >
      <View style={s.textosFila}>{children}</View>
      <Icono nombre="adelante" color={tema.textoTenue} tamano={20} />
    </Pulsable>
  )
}

/** Texto de una fila sin destino: «Y 12 más», «Nada pendiente». */
export function FilaDeTexto({
  children,
  primera = false,
}: {
  children: string
  primera?: boolean
}): React.JSX.Element {
  return (
    <View style={[s.fila, !primera && s.separada]}>
      <Text style={s.tenue}>{children}</Text>
    </View>
  )
}

/** Estado escrito dentro de una píldora: el color acompaña, no informa solo. */
export function Pildora({
  texto,
  tono,
}: {
  texto: string
  tono: "exito" | "aviso" | "neutro" | "error"
}): React.JSX.Element {
  return (
    <View style={[s.pildora, s[`pildora_${tono}`]]}>
      <Text style={[s.textoPildora, s[`textoPildora_${tono}`]]}>{texto}</Text>
    </View>
  )
}

/**
 * Relleno de la adherencia. La primera vez se llena desde cero: explica que la
 * cifra es una parte de un todo. El relleno va en absoluto y sin hijos, así que
 * animar su ancho no recoloca nada más. Después, o con movimiento reducido,
 * se pinta ya en su sitio.
 */
export function BarraDeAdherencia({
  porcentaje,
  animar,
}: {
  porcentaje: number
  animar: boolean
}): React.JSX.Element {
  const [ancho, setAncho] = useState(animar ? 0 : porcentaje)
  useEffect(() => {
    setAncho(porcentaje)
  }, [porcentaje])
  return (
    <View
      style={s.pista}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Adherencia de la semana"
      accessibilityValue={{ min: 0, max: 100, now: porcentaje, text: `${porcentaje} %` }}
    >
      <Animated.View
        style={[s.relleno, degradadoOro, animar && barra.transicion, { width: `${ancho}%` }]}
      />
    </View>
  )
}

const barra = css.create({
  transicion: {
    transitionProperty: "width",
    transitionDuration: 300,
    transitionTimingFunction: SALIDA,
  },
})

/** Botón de contorno, con la misma respuesta al pulsar que el resto de la app. */
export function BotonDeContorno({
  texto,
  onPress,
}: {
  texto: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pulsable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={onPress}
      style={s.contorno}
    >
      <Text style={s.textoContorno}>{texto}</Text>
    </Pulsable>
  )
}

export const estilosDelPanel = StyleSheet.create({
  fuerte: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16, lineHeight: 21 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 19 },
  marca: {
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
})

const s = StyleSheet.create({
  indicador: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 0,
    backgroundColor: tema.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.borde,
    padding: 16,
    gap: 2,
  },
  destacada: { borderColor: tema.bordeDestacado },
  etiqueta: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cifra: { fontFamily: tema.fuenteTitulo, fontSize: 40, lineHeight: 48 },
  detalleIndicador: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    lineHeight: 17,
  },
  seccion: { gap: 12 },
  cabeceraSeccion: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  tituloSeccion: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    lineHeight: 28,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  derecha: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  fila: {
    minHeight: 56,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  textosFila: { flex: 1, minWidth: 0, gap: 3 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 14, lineHeight: 19 },
  pildora: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  pildora_exito: { backgroundColor: tema.exitoSuave, borderColor: tema.exitoSuave },
  pildora_aviso: { backgroundColor: tema.acentoSuave, borderColor: tema.acentoSuave },
  pildora_error: { backgroundColor: "transparent", borderColor: tema.error },
  pildora_neutro: { backgroundColor: "transparent", borderColor: tema.bordeFuerte },
  textoPildora: { fontFamily: tema.fuenteSemi, fontSize: 12 },
  textoPildora_exito: { color: tema.exito },
  textoPildora_aviso: { color: tema.aviso },
  textoPildora_error: { color: tema.error },
  textoPildora_neutro: { color: tema.textoSecundario },
  pista: {
    height: 10,
    borderRadius: 5,
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
  },
  relleno: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 5 },
  contorno: {
    alignSelf: "flex-start",
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    minHeight: 48,
    justifyContent: "center",
  },
  textoContorno: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
})
