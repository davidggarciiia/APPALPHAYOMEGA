import * as Haptics from "expo-haptics"
import { useEffect, useId, useRef, useState } from "react"
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated"
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg"

import { tema } from "../tema"

/**
 * Botones "bloque con corte inclinado": rectángulo con la esquina inferior
 * derecha cortada en diagonal y el título en mayúsculas.
 *
 * Todo el movimiento va por valores compartidos de Reanimated (hilo de interfaz):
 * pulsar no vuelve a renderizar nada. El único estado de React es la medida del
 * botón, que se toma una vez para dibujar la forma con SVG (React Native no
 * recorta esquinas en diagonal).
 */

/** Cateto del corte de la esquina inferior derecha, en px. */
const CORTE = 13
/** Lo que hay que mantener pulsado un botón destructivo con confirmación. */
const MANTENER_MS = 900
/** Margen del SVG por fuera del botón para el anillo de foco. */
const MARGEN_ANILLO = 4

/** Mismas paradas que `degradadoOro` (tema.ts): SVG no entiende el CSS. */
const PARADAS_ORO = [
  ["0", "#FFF09A"],
  ["0.38", "#FFCF52"],
  ["0.72", "#FFB53C"],
  ["1", "#E99A1F"],
] as const

const ENTRADA = { damping: 22, stiffness: 520, mass: 0.5 }
/** Con poco amortiguamiento al soltar: el rebote elástico corto. */
const SALIDA = { damping: 9, stiffness: 340, mass: 0.55 }

type Variante = "principal" | "secundario" | "destructivo"

const VARIANTES: Record<
  Variante,
  {
    raiz: ViewStyle
    alto: number
    relleno: string
    trazo?: string
    texto: string
    pulsadoTrazo: string
    pulsadoRelleno?: string
    barra?: string
  }
> = {
  principal: {
    raiz: { marginTop: 24 },
    alto: 52,
    relleno: tema.boton,
    texto: tema.sobreAcento,
    pulsadoTrazo: tema.sobreAcento,
  },
  secundario: {
    raiz: { marginTop: 12, maxWidth: "100%", flexShrink: 1 },
    alto: 48,
    relleno: tema.superficieAlta,
    trazo: tema.bordeFuerte,
    texto: tema.texto,
    pulsadoTrazo: tema.acento,
  },
  destructivo: {
    raiz: { marginTop: 12 },
    alto: 48,
    relleno: "rgba(224,106,95,.08)",
    trazo: tema.error,
    texto: tema.error,
    pulsadoTrazo: tema.error,
    pulsadoRelleno: "rgba(224,106,95,.2)",
    barra: "rgba(224,106,95,.5)",
  },
}

const VIBRACIONES = {
  suave: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  exito: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  aviso: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
}

/**
 * Vibración suave. Los botones la usan al pulsar; la pantalla puede llamarla
 * cuando una operación acaba ("exito" o "error"), porque el botón no sabe cómo
 * terminó. En web no hace nada y sin motor háptico tampoco falla.
 */
export function vibrar(tipo: keyof typeof VIBRACIONES): void {
  if (Platform.OS === "web") return
  VIBRACIONES[tipo]().catch(() => undefined)
}

/** "Reducir movimiento" del sistema, también si cambia con la app abierta. */
function useMovimientoReducido(): boolean {
  const [reducido, fijar] = useState(false)
  useEffect(() => {
    let vivo = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((activo) => vivo && activo && fijar(true))
      .catch(() => undefined)
    const suscripcion = AccessibilityInfo.addEventListener("reduceMotionChanged", fijar)
    return () => {
      vivo = false
      suscripcion.remove()
    }
  }, [])
  return reducido
}

/** En web el foco por ratón no debe pintar el anillo; el de teclado, sí. */
function esFocoDeTeclado(evento: unknown): boolean {
  const destino = (evento as { target?: { matches?: (selector: string) => boolean } } | undefined)
    ?.target
  return destino?.matches?.(":focus-visible") ?? true
}

/** Valores compartidos y eventos de pulsación, ratón y teclado (sin re-renders). */
function usePulsacion(reducido: boolean, desactivado: boolean) {
  const pulsado = useSharedValue(0)
  const hover = useSharedValue(0)
  const foco = useSharedValue(0)

  const entrar = (): void => {
    if (desactivado) return
    pulsado.value = reducido ? 1 : withSpring(1, ENTRADA)
    vibrar("suave")
  }
  const salir = (): void => {
    pulsado.value = reducido ? 0 : withSpring(0, SALIDA)
  }

  // Si el botón se desactiva con el dedo puesto, `onPressOut` puede no llegar.
  useEffect(() => {
    if (desactivado) {
      pulsado.value = reducido ? 0 : withSpring(0, SALIDA)
      hover.value = 0
    }
  }, [desactivado, reducido, pulsado, hover])

  return {
    pulsado,
    hover,
    foco,
    entrar,
    salir,
    eventos: {
      onHoverIn: () => {
        if (!desactivado) hover.value = reducido ? 1 : withTiming(1, { duration: 120 })
      },
      onHoverOut: () => {
        hover.value = reducido ? 0 : withTiming(0, { duration: 160 })
      },
      onFocus: (evento: unknown) => {
        if (esFocoDeTeclado(evento)) foco.value = 1
      },
      onBlur: () => {
        foco.value = 0
      },
    },
  }
}

/** Contorno del bloque; `d` > 0 lo agranda hacia fuera y `d` < 0 lo mete hacia dentro. */
function forma(ancho: number, alto: number, d = 0): string {
  const corte = CORTE + d * (2 - Math.SQRT2)
  return `M${-d} ${-d}H${ancho + d}V${alto + d - corte}L${ancho + d - corte} ${alto + d}H${-d}Z`
}

type Medida = { ancho: number; alto: number }

/** Capa SVG decorativa del tamaño del botón, invisible para los lectores de pantalla. */
function Capa({
  medida,
  margen = 0,
  children,
}: {
  medida: Medida
  margen?: number
  children: React.ReactNode
}): React.JSX.Element {
  const ancho = medida.ancho + 2 * margen
  const alto = medida.alto + 2 * margen
  // react-native-svg en web reenvía al DOM las props de accesibilidad de React Native
  // y React protesta, así que la ocultación va en una vista que las traduce bien.
  return (
    <View
      style={{ position: "absolute", left: -margen, top: -margen, width: ancho, height: alto }}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
    >
      <Svg width={ancho} height={alto} viewBox={`${-margen} ${-margen} ${ancho} ${alto}`}>
        {children}
      </Svg>
    </View>
  )
}

/** Tres bloques que se encienden en ola; con movimiento reducido quedan fijos. */
function Puntos({ color, animar }: { color: string; animar: boolean }): React.JSX.Element {
  const fase = useSharedValue(0)
  useEffect(() => {
    if (animar) fase.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1)
    return () => cancelAnimation(fase)
  }, [animar, fase])
  return (
    <View
      style={estilos.puntos}
      testID="boton-puntos"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {[0, 1, 2].map((k) => (
        <Punto key={k} k={k} fase={fase} color={color} animar={animar} />
      ))}
    </View>
  )
}

function Punto({
  k,
  fase,
  color,
  animar,
}: {
  k: number
  fase: SharedValue<number>
  color: string
  animar: boolean
}): React.JSX.Element {
  const animado = useAnimatedStyle(() => ({
    opacity: animar ? 1 - 0.75 * ((fase.value - k / 3 + 1) % 1) : 0.85,
  }))
  return <Animated.View style={[estilos.punto, { backgroundColor: color }, animado]} />
}

type PropiedadesBoton = {
  texto: string
  onPress: () => void
  ocupado?: boolean
  etiquetaAccesible?: string
  deshabilitado?: boolean
}

export function BotonPrincipal(props: PropiedadesBoton): React.JSX.Element {
  return <Boton {...props} variante="principal" />
}

/**
 * Acción secundaria: cancelar, volver, reenviar.
 *
 * Cuando todos los botones de una pantalla se ven igual, el que da de baja a
 * alguien se pulsa por error tarde o temprano.
 */
export function BotonSecundario(props: PropiedadesBoton): React.JSX.Element {
  return <Boton {...props} variante="secundario" />
}

/**
 * Acción con consecuencias, identificada por su texto y separada de guardar.
 *
 * `mantenerParaConfirmar` (opt-in) sustituye el toque por mantener pulsado hasta
 * llenar una barra. Con lector de pantalla, la acción "activar" confirma directo:
 * el doble toque ya es deliberado.
 */
export function BotonDestructivo(
  props: PropiedadesBoton & { mantenerParaConfirmar?: boolean },
): React.JSX.Element {
  return <Boton {...props} variante="destructivo" />
}

function Boton({
  variante,
  texto,
  etiquetaAccesible = texto,
  onPress,
  ocupado = false,
  deshabilitado = false,
  mantenerParaConfirmar = false,
}: PropiedadesBoton & { variante: Variante; mantenerParaConfirmar?: boolean }): React.JSX.Element {
  const v = VARIANTES[variante]
  const desactivado = ocupado || deshabilitado
  const reducido = useMovimientoReducido()
  const [medida, setMedida] = useState<Medida | null>(null)
  const ultimaMedida = useRef<Medida | null>(null)
  const idDegradado = useId()
  const ancho = useSharedValue(0)
  const destello = useSharedValue(1)
  const avance = useSharedValue(0)
  const { pulsado, hover, foco, entrar, salir, eventos } = usePulsacion(reducido, desactivado)
  const conDestello = variante === "principal" && !reducido
  const k = reducido ? 0 : 1

  useEffect(() => {
    if (desactivado) avance.value = withTiming(0, { duration: 160 })
  }, [desactivado, avance])

  const cuerpo = useAnimatedStyle(() => ({
    transform: [
      { translateX: 2 * k * pulsado.value },
      { translateY: 2 * k * pulsado.value },
      { scale: 1 - 0.015 * k * pulsado.value },
    ],
  }))
  const borde = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(pulsado.value, 0.55 * hover.value)),
  }))
  const anillo = useAnimatedStyle(() => ({ opacity: foco.value }))
  // El destello se apaga antes de llegar a la esquina cortada, que el recorte
  // rectangular de la capa no puede ocultar.
  const brillo = useAnimatedStyle(() => ({
    opacity: 0.75 * (1 - destello.value) * (1 - destello.value),
    transform: [{ translateX: -44 + destello.value * (ancho.value + 88) }, { skewX: "-20deg" }],
  }))
  const barra = useAnimatedStyle(() => ({ width: ancho.value * avance.value }))

  const alEntrar = (): void => {
    entrar()
    if (conDestello) {
      destello.value = 0
      destello.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })
    }
    // Es una barra de progreso, no adorno: se anima también con movimiento reducido.
    if (mantenerParaConfirmar) {
      avance.value = withTiming(1, { duration: MANTENER_MS, easing: Easing.linear })
    }
  }
  const alSalir = (): void => {
    salir()
    if (mantenerParaConfirmar) avance.value = withTiming(0, { duration: 160 })
  }
  // La referencia evita renderizar de nuevo cuando llega la misma medida.
  const medir = (evento: LayoutChangeEvent): void => {
    const { width, height } = evento.nativeEvent.layout
    ancho.value = width
    const previa = ultimaMedida.current
    if (previa && Math.abs(previa.ancho - width) < 0.5 && Math.abs(previa.alto - height) < 0.5)
      return
    ultimaMedida.current = { ancho: width, alto: height }
    setMedida(ultimaMedida.current)
  }

  return (
    <Pressable
      style={[v.raiz, Platform.OS === "web" && estilos.sinContornoWeb]}
      onPress={mantenerParaConfirmar ? undefined : onPress}
      onLongPress={
        mantenerParaConfirmar
          ? () => {
              vibrar("aviso")
              onPress()
            }
          : undefined
      }
      delayLongPress={MANTENER_MS}
      onPressIn={alEntrar}
      onPressOut={alSalir}
      {...eventos}
      disabled={desactivado}
      accessibilityRole="button"
      // El nombre accesible no cambia mientras se envía.
      accessibilityLabel={etiquetaAccesible}
      accessibilityState={{ disabled: desactivado, busy: ocupado }}
      aria-busy={ocupado}
      accessibilityHint={mantenerParaConfirmar ? "Mantén pulsado para confirmar" : undefined}
      accessibilityActions={
        mantenerParaConfirmar ? [{ name: "activate", label: etiquetaAccesible }] : undefined
      }
      onAccessibilityAction={
        mantenerParaConfirmar
          ? (evento) => {
              if (evento.nativeEvent.actionName === "activate") onPress()
            }
          : undefined
      }
    >
      <Animated.View
        onLayout={medir}
        style={[
          estilos.cuerpo,
          { minHeight: v.alto },
          // Mientras no hay medida se pinta el rectángulo liso; la forma sustituye al fotograma siguiente.
          medida === null && { backgroundColor: v.relleno },
          deshabilitado && !ocupado && estilos.deshabilitado,
          cuerpo,
        ]}
      >
        {medida !== null && (
          <Capa medida={medida}>
            {variante === "principal" ? (
              <>
                <Defs>
                  <LinearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
                    {PARADAS_ORO.map(([desplazamiento, color]) => (
                      <Stop key={desplazamiento} offset={desplazamiento} stopColor={color} />
                    ))}
                  </LinearGradient>
                </Defs>
                <Path d={forma(medida.ancho, medida.alto)} fill={`url(#${idDegradado})`} />
                <Path
                  d={forma(medida.ancho, medida.alto, -1)}
                  fill="none"
                  stroke="rgba(0,0,0,.22)"
                  strokeWidth={1}
                />
                <Path
                  d={`M1 ${medida.alto - 1}V1H${medida.ancho - 1}`}
                  fill="none"
                  stroke="rgba(255,255,255,.6)"
                  strokeWidth={1}
                />
              </>
            ) : (
              <Path
                d={forma(medida.ancho, medida.alto, -0.75)}
                fill={v.relleno}
                stroke={v.trazo}
                strokeWidth={1.5}
              />
            )}
          </Capa>
        )}
        {medida !== null && mantenerParaConfirmar && (
          <Animated.View style={[estilos.barra, barra]} testID="boton-barra" pointerEvents="none">
            <Capa medida={medida}>
              <Path d={forma(medida.ancho, medida.alto)} fill={v.barra} />
            </Capa>
          </Animated.View>
        )}
        {medida !== null && (
          <Animated.View
            style={[estilos.capa, borde]}
            testID="boton-borde"
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Capa medida={medida}>
              <Path
                d={forma(medida.ancho, medida.alto, -1.5)}
                fill={v.pulsadoRelleno ?? "none"}
                stroke={v.pulsadoTrazo}
                strokeWidth={3}
              />
            </Capa>
          </Animated.View>
        )}
        {medida !== null && Platform.OS === "web" && (
          <Animated.View
            style={[estilos.capa, anillo]}
            testID="boton-anillo"
            pointerEvents="none"
            accessible={false}
          >
            <Capa medida={medida} margen={MARGEN_ANILLO}>
              <Path
                d={forma(medida.ancho, medida.alto, 3)}
                fill="none"
                stroke={tema.texto}
                strokeWidth={2}
              />
            </Capa>
          </Animated.View>
        )}
        {conDestello && (
          <View
            style={estilos.recorte}
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View style={[estilos.brillo, brillo]} testID="boton-brillo" />
          </View>
        )}
        <Text style={[estilos.titulo, { color: v.texto }, ocupado && estilos.oculto]}>{texto}</Text>
        {mantenerParaConfirmar && (
          <Text style={[estilos.pista, { color: v.texto }]}>Mantén pulsado</Text>
        )}
        {ocupado && <Puntos color={v.texto} animar={!reducido} />}
      </Animated.View>
    </Pressable>
  )
}

/**
 * Enlace para volver o cancelar: sin bloque, con un subrayado que crece al
 * pulsar, pasar el ratón o enfocar con teclado.
 */
export function BotonEnlace({
  texto,
  onPress,
  etiquetaAccesible = texto,
  ocupado = false,
  deshabilitado = false,
}: PropiedadesBoton): React.JSX.Element {
  const desactivado = ocupado || deshabilitado
  const reducido = useMovimientoReducido()
  const { pulsado, hover, foco, entrar, salir, eventos } = usePulsacion(reducido, desactivado)
  const subrayado = useAnimatedStyle(() => ({
    transform: [
      { scaleX: 0.3 + 0.7 * Math.min(1, Math.max(pulsado.value, hover.value, foco.value)) },
    ],
  }))
  return (
    <Pressable
      style={[estilos.enlace, Platform.OS === "web" && estilos.sinContornoWeb]}
      onPress={onPress}
      onPressIn={entrar}
      onPressOut={salir}
      {...eventos}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      accessibilityState={{ disabled: desactivado, busy: ocupado }}
      aria-busy={ocupado}
    >
      <View style={deshabilitado && !ocupado ? estilos.deshabilitado : undefined}>
        <Text style={estilos.textoEnlace}>{texto}</Text>
        <Animated.View
          style={[estilos.subrayado, subrayado]}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    </Pressable>
  )
}

const estilos = StyleSheet.create({
  cuerpo: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  deshabilitado: { opacity: 0.45 },
  capa: { ...StyleSheet.absoluteFill },
  barra: { position: "absolute", left: 0, top: 0, bottom: 0, overflow: "hidden" },
  recorte: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  brillo: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 34,
    backgroundColor: tema.acentoClaro,
  },
  titulo: {
    fontFamily: tema.fuenteTitulo,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  pista: {
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  oculto: { opacity: 0 },
  puntos: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
  },
  punto: { width: 8, height: 8, transform: [{ skewX: "-20deg" }] },
  sinContornoWeb: { outlineColor: "transparent" },
  enlace: {
    alignSelf: "center",
    marginTop: 8,
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  textoEnlace: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 14,
    letterSpacing: 1.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  subrayado: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -4,
    height: 2,
    backgroundColor: tema.acento,
    transformOrigin: "0% 50%",
  },
})
