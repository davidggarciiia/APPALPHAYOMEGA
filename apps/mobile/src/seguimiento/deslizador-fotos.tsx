import { useRef, useState } from "react"
import {
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"

import { Icono } from "../componentes/iconos"
import { Pulsable } from "../componentes/pulsable"
import { useMovimientoReducido } from "../lib/movimiento"
import { degradadoOro, tema } from "../tema"
import { ImagenPrivada } from "./imagen-privada"
import type { ApiMedios } from "./medios-api"

/** Movimiento dentro de la pantalla: arranca y llega suave, sin rebote. */
const EN_PANTALLA = Easing.bezier(0.77, 0, 0.175, 1)
/** Cada toque de los botones o del lector mueve el divisor una décima parte. */
const PASO = 0.1
const TIRADOR = 44

export type FotoDeslizable = {
  medioId: string
  /** «Frente, 4 jul 2026»: el nombre de la foto para el lector. */
  etiqueta: string
  /** «4 jul 2026 · Hace 84 días», bajo el marco. */
  rotulo: string
}

const acotar = (valor: number): number => Math.min(1, Math.max(0, valor))

/**
 * Antes y después en el mismo marco, como en MyFitnessPal: a la izquierda del
 * divisor se ve la foto de antes y a la derecha la de después. Se arrastra o se
 * toca donde se quiera poner el divisor.
 *
 * El dedo mueve un valor compartido de Reanimated y el recorte se aplica con
 * transformaciones en el hilo de la interfaz: React no vuelve a pintar mientras
 * se arrastra. Solo al soltar se anota la posición para el lector de pantalla.
 * Sin teclado ni dedo, los botones «Más antes» y «Más después» y las acciones
 * de subir y bajar del lector hacen lo mismo en pasos de un 10 %. Con
 * movimiento reducido, los botones colocan el divisor sin desplazarlo.
 */
export function DeslizadorFotos({
  antes,
  despues,
  acceso,
}: {
  antes: FotoDeslizable
  despues: FotoDeslizable
  acceso: ApiMedios["acceso"]
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  // Parte del ancho que ocupa la foto de antes, de 0 a 1. Los valores
  // compartidos mueven las capas; las referencias guardan lo mismo para las
  // cuentas de los manejadores, que así no leen del hilo de la interfaz.
  const posicion = useSharedValue(0.5)
  const ancho = useSharedValue(0)
  const ultima = useRef(0.5)
  const anchoMedido = useRef(0)
  const [medido, setMedido] = useState(false)
  const [porcentaje, setPorcentaje] = useState(50)
  const [fallo, setFallo] = useState(false)
  const [intento, setIntento] = useState(0)

  // El recorte se desplaza a la izquierda y la foto, lo mismo a la derecha:
  // la foto no se mueve y solo cambia cuánto de ella queda a la vista.
  const recorte = useAnimatedStyle(() => ({
    transform: [{ translateX: (posicion.get() - 1) * ancho.get() }],
  }))
  const fotoFija = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - posicion.get()) * ancho.get() }],
  }))
  const divisor = useAnimatedStyle(() => ({
    transform: [{ translateX: posicion.get() * ancho.get() }],
  }))

  const medir = (e: LayoutChangeEvent): void => {
    anchoMedido.current = e.nativeEvent.layout.width
    ancho.set(e.nativeEvent.layout.width)
    setMedido(true)
  }
  const seguirDedo = (e: GestureResponderEvent): void => {
    if (anchoMedido.current <= 0) return
    // Bajo el dedo, sin animación: el divisor va donde está el dedo.
    ultima.current = acotar(e.nativeEvent.locationX / anchoMedido.current)
    posicion.set(ultima.current)
  }
  const mover = (sentido: 1 | -1): void => {
    const destino = acotar(Math.round((ultima.current + sentido * PASO) * 10) / 10)
    ultima.current = destino
    posicion.set(reducido ? destino : withTiming(destino, { duration: 200, easing: EN_PANTALLA }))
    setPorcentaje(Math.round(destino * 100))
  }
  const accionDelLector = (e: AccessibilityActionEvent): void => {
    if (e.nativeEvent.actionName === "increment") mover(1)
    if (e.nativeEvent.actionName === "decrement") mover(-1)
  }

  return (
    <View style={s.contenedor}>
      <View
        testID="deslizador-fotos"
        style={s.marco}
        onLayout={medir}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Divisor entre antes, ${antes.etiqueta}, y después, ${despues.etiqueta}`}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: porcentaje,
          text: `${porcentaje} % de la foto de antes a la vista`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={accionDelLector}
      >
        {/* Después, debajo: es lo que queda a la derecha del divisor. */}
        <ImagenPrivada
          key={`despues-${intento}`}
          medioId={despues.medioId}
          etiqueta={despues.etiqueta}
          acceso={acceso}
          variante="capa"
          alFallar={() => setFallo(true)}
        />
        {medido && (
          <>
            <Animated.View style={[s.recorte, recorte]} pointerEvents="none">
              <Animated.View style={[StyleSheet.absoluteFill, fotoFija]}>
                <ImagenPrivada
                  key={`antes-${intento}`}
                  medioId={antes.medioId}
                  etiqueta={antes.etiqueta}
                  acceso={acceso}
                  variante="capa"
                  alFallar={() => setFallo(true)}
                />
              </Animated.View>
            </Animated.View>
            <Animated.View style={[s.divisor, divisor]} pointerEvents="none">
              <View style={s.linea} />
              <View style={[s.tirador, degradadoOro]}>
                <Icono nombre="atras" color={tema.sobreAcento} tamano={16} />
                <Icono nombre="adelante" color={tema.sobreAcento} tamano={16} />
              </View>
            </Animated.View>
          </>
        )}
        <View style={s.marcas} pointerEvents="none">
          <Text style={s.marca}>ANTES</Text>
          <Text style={s.marca}>DESPUÉS</Text>
        </View>
        {/* Encima de todo, para que el dedo mida siempre respecto al marco. */}
        <View
          testID="deslizador-tactil"
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={seguirDedo}
          onResponderMove={seguirDedo}
          onResponderRelease={() => setPorcentaje(Math.round(ultima.current * 100))}
        />
      </View>

      <View style={s.pie}>
        <Text style={s.fecha}>{`Antes: ${antes.rotulo}`}</Text>
        <Text style={[s.fecha, s.derecha]}>{`Después: ${despues.rotulo}`}</Text>
      </View>

      {fallo && (
        <View style={s.fila}>
          <Text style={s.error} accessibilityRole="alert">
            No se ha podido cargar alguna de las fotos.
          </Text>
          <Pulsable
            style={s.boton}
            accessibilityRole="button"
            accessibilityLabel="Volver a cargar las dos fotos"
            onPress={() => {
              setFallo(false)
              setIntento((n) => n + 1)
            }}
          >
            <Text style={s.textoBoton}>Reintentar</Text>
          </Pulsable>
        </View>
      )}

      <View style={s.fila}>
        <Pulsable
          style={[s.boton, s.mitad, porcentaje >= 100 && s.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Mostrar más de la foto de antes"
          accessibilityState={{ disabled: porcentaje >= 100 }}
          disabled={porcentaje >= 100}
          onPress={() => mover(1)}
        >
          <Text style={s.textoBoton}>Más antes</Text>
        </Pulsable>
        <Pulsable
          style={[s.boton, s.mitad, porcentaje <= 0 && s.apagado]}
          accessibilityRole="button"
          accessibilityLabel="Mostrar más de la foto de después"
          accessibilityState={{ disabled: porcentaje <= 0 }}
          disabled={porcentaje <= 0}
          onPress={() => mover(-1)}
        >
          <Text style={s.textoBoton}>Más después</Text>
        </Pulsable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { gap: 10, width: "100%", maxWidth: 480, alignSelf: "center" },
  marco: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: tema.hundido,
    overflow: "hidden",
  },
  recorte: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  divisor: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -TIRADOR / 2,
    width: TIRADOR,
    alignItems: "center",
    justifyContent: "center",
  },
  linea: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: TIRADOR / 2 - 1,
    width: 2,
    backgroundColor: tema.texto,
  },
  tirador: {
    width: TIRADOR,
    height: TIRADOR,
    borderRadius: TIRADOR / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  marcas: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  marca: {
    color: tema.texto,
    backgroundColor: "rgba(14,13,11,.72)",
    fontFamily: tema.fuenteBoton,
    fontSize: 12,
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  pie: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  fecha: { flex: 1, color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  derecha: { textAlign: "right" },
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  boton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  mitad: { flex: 1 },
  apagado: { opacity: 0.45 },
  textoBoton: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  error: { flex: 1, color: tema.error, fontFamily: tema.fuenteSemi, fontSize: 14 },
})
