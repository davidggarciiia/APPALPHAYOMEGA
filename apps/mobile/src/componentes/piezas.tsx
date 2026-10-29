import { useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"

import { alto, espacio, radio, tema } from "../tema"
import { INDICADOR, useMovimientoReducido } from "./movimiento"

export function Chip({
  texto,
  activo = false,
  onPress,
  deshabilitado = false,
  etiqueta = texto,
}: {
  texto: string
  activo?: boolean
  onPress: () => void
  deshabilitado?: boolean
  etiqueta?: string
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: activo, disabled: deshabilitado }}
      disabled={deshabilitado}
      hitSlop={2}
      onPress={onPress}
      style={[s.chip, activo && s.chipActivo, deshabilitado && s.deshabilitado]}
    >
      <Text style={[s.textoChip, activo && s.textoActivo]}>{texto}</Text>
    </Pressable>
  )
}

export function Pestanas<T extends string>({
  opciones,
  activa,
  cambiar,
  bloquearCambio = false,
  variante = "subrayado",
}: {
  opciones: ReadonlyArray<{ valor: T; texto: string }>
  activa: T
  cambiar: (valor: T) => void
  bloquearCambio?: boolean
  variante?: "subrayado" | "pil"
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const scroll = useRef<ScrollView>(null)
  const [medidas, fijarMedidas] = useState<Record<string, { x: number; width: number }>>({})
  const [ancho, fijarAncho] = useState(0)
  const x = useSharedValue(0)
  const largo = useSharedValue(0)
  const medida = medidas[activa]
  useEffect(() => {
    cancelAnimation(x)
    cancelAnimation(largo)
    if (!medida) return
    x.value = reducido ? medida.x : withSpring(medida.x, INDICADOR)
    largo.value = reducido ? medida.width : withSpring(medida.width, INDICADOR)
    scroll.current?.scrollTo({
      x: Math.max(0, medida.x - (ancho - medida.width) / 2),
      animated: !reducido,
    })
    return () => {
      cancelAnimation(x)
      cancelAnimation(largo)
    }
  }, [medida, ancho, reducido, x, largo])
  const indicador = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scaleX: largo.value }],
  }))
  const pil = variante === "pil"
  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(evento) => fijarAncho(evento.nativeEvent.layout.width)}
      style={[s.pestanas, pil && s.segmentado]}
      contentContainerStyle={[s.filaPestanas, pil && s.filaSegmentada]}
      accessibilityRole="tablist"
    >
      {opciones.map((opcion) => {
        const elegida = opcion.valor === activa
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole="tab"
            accessibilityLabel={opcion.texto}
            accessibilityState={{ selected: elegida, disabled: bloquearCambio && !elegida }}
            disabled={bloquearCambio && !elegida}
            onPress={() => cambiar(opcion.valor)}
            onLayout={(evento) => {
              const { x: posicion, width } = evento.nativeEvent.layout
              fijarMedidas((previas) =>
                previas[opcion.valor]?.x === posicion && previas[opcion.valor]?.width === width
                  ? previas
                  : { ...previas, [opcion.valor]: { x: posicion, width } },
              )
            }}
            style={[s.pestana, pil && s.pestanaSegmentada, pil && elegida && s.segmentoActivo]}
          >
            <Text style={[s.textoPestana, elegida && s.textoActivo]}>{opcion.texto}</Text>
          </Pressable>
        )
      })}
      {!pil && (
        <Animated.View
          testID="pestanas-indicador"
          pointerEvents="none"
          accessible={false}
          style={[s.indicador, indicador]}
        />
      )}
    </ScrollView>
  )
}

export type VarianteTarjeta = "normal" | "destacada" | "aviso" | "lista"

export function Tarjeta({
  children,
  variante = "normal",
}: {
  children: ReactNode
  variante?: VarianteTarjeta
}): React.JSX.Element {
  return (
    <View
      testID="tarjeta"
      style={[
        s.tarjeta,
        variante === "lista" && s.lista,
        variante === "destacada" && s.destacada,
        variante === "aviso" && s.aviso,
      ]}
    >
      {children}
    </View>
  )
}

export function Fila({
  children,
  primera = false,
}: {
  children: ReactNode
  primera?: boolean
}): React.JSX.Element {
  return (
    <View testID="tarjeta-fila" style={[s.fila, !primera && s.separada]}>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  chip: {
    minHeight: 40,
    paddingHorizontal: espacio[16],
    borderRadius: radio.pastilla,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
    backgroundColor: tema.superficie,
  },
  chipActivo: { backgroundColor: tema.acentoSuave, borderColor: tema.acento },
  textoChip: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    textTransform: "uppercase",
  },
  deshabilitado: { opacity: 0.5 },
  pestanas: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: tema.borde },
  filaPestanas: { flexDirection: "row", gap: espacio[24] },
  pestana: { minHeight: alto.tactil, justifyContent: "center" },
  textoPestana: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 16 },
  textoActivo: { color: tema.acento },
  indicador: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 1,
    height: 2,
    backgroundColor: tema.acento,
    transformOrigin: "left center",
  },
  segmentado: { borderBottomWidth: 0, borderRadius: radio.campo, backgroundColor: tema.superficie },
  filaSegmentada: { flexGrow: 1, gap: espacio[4] },
  pestanaSegmentada: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: espacio[12],
    borderRadius: radio.campo,
  },
  segmentoActivo: { backgroundColor: tema.superficieAlta },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, padding: espacio[16] },
  lista: { padding: 0, paddingHorizontal: espacio[16] },
  destacada: { borderWidth: 1, borderColor: tema.bordeDestacado },
  aviso: { borderWidth: 1, borderColor: tema.avisoBorde },
  fila: {
    minHeight: 56,
    paddingVertical: espacio[12],
    flexDirection: "row",
    gap: espacio[12],
    alignItems: "center",
  },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
})
