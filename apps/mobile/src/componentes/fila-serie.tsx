import type { EjercicioPrescrito, SeriePrescrita } from "@alpha-omega/shared"
import { useCallback, useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native"
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { radio, tema } from "../tema"
import { vibrar } from "./botones"
import { CURVA, useDestello, useMovimientoReducido } from "./movimiento"

export type CeldaSerie = "peso" | "cantidad" | "rir"
export type FilaSerieProps = {
  numero: number
  /** Nombre del ejercicio, para contextualizar cada control accesible. */
  etiqueta: string
  tipoMedicion: SeriePrescrita["tipoMedicion"]
  tipoCarga?: EjercicioPrescrito["tipoCarga"]
  modoRir?: EjercicioPrescrito["modoRir"]
  anterior?: string
  recordPersonal?: string
  /** Una mejora ya celebrada no vuelve a destellar al deshacer y remarcar. */
  destelloAlCompletar?: boolean
  peso?: number | string | null
  pesoSugerido?: number | null
  cantidad?: number | string | null
  cantidadSugerida: number
  rir?: number | null
  rirObjetivo?: number | null
  hecha?: boolean
  omitida?: boolean
  primeraPendiente?: boolean
  enfocada?: CeldaSerie | null
  deshabilitado?: boolean
  alEnfocar: (celda: CeldaSerie) => void
  alCambiarHecha: (hecha: boolean) => void
  alOmitir?: () => void
  alRecuperar?: () => void
}

const Trazo = Animated.createAnimatedComponent(Path)
const UNIDADES = { repeticiones: "Repeticiones", tiempo: "Segundos", distancia: "Metros" } as const
let terminarFaseActiva: (() => void) | undefined

function legible(valor: number | string | null | undefined): string {
  if (
    valor === null ||
    valor === undefined ||
    valor === "" ||
    (typeof valor === "number" && !Number.isFinite(valor))
  )
    return "—"
  return String(valor).replace(".", ",")
}

/** Una fila prescrita; el dueño conserva la edición, el marcado y el guardado. */
export function FilaSerie({
  numero,
  etiqueta,
  tipoMedicion,
  tipoCarga = "conCargaExterna",
  modoRir = "cadaSerie",
  anterior = "—",
  recordPersonal,
  destelloAlCompletar = true,
  peso,
  pesoSugerido,
  cantidad,
  cantidadSugerida,
  rir,
  rirObjetivo,
  hecha = false,
  omitida = false,
  primeraPendiente = false,
  enfocada = null,
  deshabilitado = false,
  alEnfocar,
  alCambiarHecha,
  alOmitir,
  alRecuperar,
}: FilaSerieProps): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const { width, fontScale } = useWindowDimensions()
  const ancho = useSharedValue(0)
  const destello = useDestello(ancho)
  const dispararDestello = destello.disparar
  // Una fase mueve fondo, check y tick; el destello es la segunda animación.
  const fase = useSharedValue(hecha ? 1 : 0)
  const previa = useRef(hecha)
  const terminarFase = useCallback(() => {
    cancelAnimation(fase)
    fase.value = Number(previa.current)
  }, [fase])
  useEffect(
    () => () => {
      terminarFase()
      if (terminarFaseActiva === terminarFase) terminarFaseActiva = undefined
    },
    [terminarFase],
  )
  const filaAnimada = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.min(1, (fase.value * 220) / 180),
      [0, 1],
      ["transparent", tema.exitoFila],
    ),
  }))
  const checkAnimado = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          reducido || !hecha
            ? 1
            : fase.value < 0.55
              ? 0.85 + (fase.value / 0.55) * 0.23
              : 1.08 - ((fase.value - 0.55) / 0.45) * 0.08,
      },
    ],
  }))
  const trazoAnimado = useAnimatedProps(() => ({
    strokeDashoffset: (1 - Math.min(1, (fase.value * 220) / 160)) * 24,
  }))
  useEffect(() => {
    cancelAnimation(fase)
    if (previa.current !== hecha && !reducido) {
      if (terminarFaseActiva !== terminarFase) terminarFaseActiva?.()
      terminarFaseActiva = terminarFase
    }
    if (hecha && !previa.current) {
      vibrar("exito")
      if (destelloAlCompletar) dispararDestello()
    }
    fase.value =
      reducido || previa.current === hecha
        ? Number(hecha)
        : withTiming(Number(hecha), { duration: hecha ? 220 : 120, easing: CURVA.entrada })
    previa.current = hecha
    return () => cancelAnimation(fase)
  }, [hecha, reducido, fase, dispararDestello, terminarFase, destelloAlCompletar])
  const omitir = (): void => {
    if (deshabilitado || omitida || !alOmitir) return
    vibrar("aviso")
    alOmitir()
  }
  const recuperar = (): void => {
    if (!deshabilitado && omitida) alRecuperar?.()
  }
  const marcar = (): void => {
    if (deshabilitado) return
    if (omitida) {
      recuperar()
      return
    }
    alCambiarHecha(!hecha)
  }
  const celda = (
    nombre: CeldaSerie,
    titulo: string,
    valor: number | string | null | undefined,
    sugerido: number | null | undefined,
  ): React.JSX.Element => {
    const vacia = valor === null || valor === undefined || valor === ""
    const mostrado = vacia ? sugerido : valor
    const bajo =
      nombre === "rir" &&
      rir !== null &&
      rir !== undefined &&
      rirObjetivo !== null &&
      rirObjetivo !== undefined &&
      rir < rirObjetivo
    const texto = nombre === "rir" && mostrado === 5 ? "5+" : legible(mostrado)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${titulo} — ${etiqueta}, serie ${numero}: ${texto}${bajo ? ", por debajo del objetivo" : ""}`}
        accessibilityHint={
          omitida
            ? "Serie omitida. Toca para recuperarla"
            : `Abre la barra de ajuste${vacia ? `; sugerencia ${texto}` : ""}`
        }
        accessibilityState={{ disabled: deshabilitado, selected: enfocada === nombre }}
        disabled={deshabilitado}
        onPress={() => (omitida ? recuperar() : alEnfocar(nombre))}
        onLongPress={omitir}
        delayLongPress={500}
        style={[
          s.celda,
          nombre === "rir" && s.rir,
          hecha && s.celdaHecha,
          enfocada === nombre && s.enfocada,
        ]}
      >
        <Text
          style={[s.valor, vacia && !hecha && enfocada !== nombre && s.sugerido, bajo && s.bajo]}
        >
          {texto}
        </Text>
      </Pressable>
    )
  }
  return (
    <Pressable
      accessibilityRole="none"
      accessibilityLabel={`Serie ${numero} — ${etiqueta}${omitida ? ", omitida" : ""}`}
      accessible={false}
      tabIndex={-1}
      onLongPress={omitir}
      delayLongPress={500}
      onPress={recuperar}
      disabled={deshabilitado}
      style={s.contenedor}
    >
      <Animated.View
        testID="fila-serie"
        onLayout={(evento) => {
          ancho.value = evento.nativeEvent.layout.width
        }}
        style={[s.fila, filaAnimada, omitida && s.omitida]}
      >
        <Text
          numberOfLines={1}
          style={[s.numero, primeraPendiente && !hecha && !omitida && s.numeroActual]}
        >
          {numero}
        </Text>
        {width >= 360 && fontScale <= 1.3 && (
          <Text accessibilityLabel={`Anterior: ${anterior}`} style={s.anterior}>
            {anterior}
          </Text>
        )}
        {tipoCarga !== "sinCarga" && celda("peso", "Peso", peso, pesoSugerido)}
        {celda("cantidad", UNIDADES[tipoMedicion], cantidad, cantidadSugerida)}
        {modoRir === "cadaSerie" && celda("rir", "RIR", rir, rirObjetivo)}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`Hecha — ${etiqueta}, serie ${numero}`}
          accessibilityHint={
            omitida
              ? "Serie omitida. Toca para recuperarla"
              : alOmitir
                ? "Mantén pulsado para omitir la serie"
                : undefined
          }
          accessibilityState={{ checked: hecha, disabled: deshabilitado }}
          aria-checked={hecha}
          disabled={deshabilitado}
          onPress={marcar}
          onLongPress={omitir}
          delayLongPress={500}
          accessibilityActions={
            omitida && alRecuperar
              ? [{ name: "recuperar", label: "Recuperar serie" }]
              : alOmitir
                ? [{ name: "omitir", label: "Omitir serie" }]
                : []
          }
          onAccessibilityAction={(evento) => {
            if (evento.nativeEvent.actionName === "omitir") omitir()
            if (evento.nativeEvent.actionName === "recuperar") recuperar()
          }}
          style={[s.check, hecha && s.hecha]}
        >
          <Animated.View
            style={checkAnimado}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Trazo
                d="M4 12l5 5L20 6"
                stroke={tema.sobreExito}
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[24]}
                animatedProps={trazoAnimado}
              />
            </Svg>
          </Animated.View>
        </Pressable>
        {!reducido && (
          <Animated.View
            testID="serie-destello"
            pointerEvents="none"
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={[s.destello, destello.estilo]}
          />
        )}
      </Animated.View>
      {hecha && recordPersonal && (
        <Text
          accessibilityLabel={`Récord personal: ${recordPersonal}`}
          accessibilityLiveRegion="polite"
          style={s.record}
        >
          {recordPersonal}
        </Text>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  contenedor: { minHeight: 52 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 52,
    borderRadius: radio.campo,
    overflow: "hidden",
  },
  numero: {
    width: 22,
    minWidth: 22,
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 13,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  numeroActual: { color: tema.acento },
  anterior: {
    width: 52,
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 13,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  celda: {
    flex: 1,
    minWidth: 52,
    minHeight: 44,
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.borde,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  rir: { flex: 0, width: 44, minWidth: 44 },
  celdaHecha: { borderColor: "transparent", backgroundColor: "transparent" },
  enfocada: {
    borderColor: tema.acento,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 3, color: tema.anilloFoco },
    ],
  },
  valor: {
    fontFamily: tema.fuenteBoton,
    fontSize: 17,
    color: tema.texto,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  sugerido: { color: tema.marcador },
  bajo: { color: tema.aviso },
  check: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radio.celda,
    borderWidth: 1.5,
    borderColor: tema.bordeFuerte,
  },
  hecha: { borderColor: tema.exito, backgroundColor: tema.exito },
  omitida: { opacity: 0.5 },
  record: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "right",
    paddingHorizontal: 8,
    fontVariant: ["tabular-nums"],
  },
  destello: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 34,
    backgroundColor: tema.acentoClaro,
  },
})
