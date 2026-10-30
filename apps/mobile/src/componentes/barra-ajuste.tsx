import * as Haptics from "expo-haptics"
import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { radio, tema } from "../tema"
import { ChipsRir } from "./chips-rir"
import { CURVA, HOJA, useMovimientoReducido } from "./movimiento"
import { NumeroGiro } from "./numero-giro"

export type UnidadAjuste = "kg" | "reps" | "seg" | "m" | "series" | "rir"
export type BarraAjusteProps = {
  unidad: UnidadAjuste
  valor: number | null
  cambiar: (valor: number) => void
  /** Los campos opcionales pueden retirar el valor sin convertirlo en cero. */
  alVaciar?: () => void
  alListo: () => void
  /** Impide confirmar la sesión mientras la entrada manual tiene texto sin aceptar. */
  alCambiarValidez?: (valida: boolean) => void
  subidaKg?: number | null
  objetivo?: number | null
  minimo?: number
  maximo?: number
  visible?: boolean
  deshabilitado?: boolean
  /** Incluye el safe-area inferior cuando la pantalla lo necesita. */
  margenInferior?: number
  /** Contexto y selector de límites del objetivo en el constructor. */
  encabezado?: ReactNode
  /** Aviso que comparte el flujo vertical de la tarjeta y queda siempre encima. */
  encima?: ReactNode
  paso?: number
}

function decimal(valor: number): string {
  return String(valor).replace(".", ",")
}

/** Ajuste controlado: el teclado solo aparece después de tocar la cifra grande. */
export function BarraAjuste({
  unidad,
  valor,
  cambiar,
  alVaciar,
  alListo,
  alCambiarValidez,
  subidaKg,
  objetivo,
  minimo = 0,
  maximo = Number.MAX_SAFE_INTEGER,
  visible = true,
  deshabilitado = false,
  margenInferior = 20,
  encabezado,
  encima,
  paso: pasoExplicito,
}: BarraAjusteProps): React.JSX.Element | null {
  const reducido = useMovimientoReducido()
  const { height: altoVentana, fontScale } = useWindowDimensions()
  const [tecladoY, setTecladoY] = useState<number | null>(null)
  const [manual, setManual] = useState(false)
  const [montada, setMontada] = useState(visible)
  const [texto, setTexto] = useState("")
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repitio = useRef(false)
  const presionActiva = useRef(false)
  const gestoCancelado = useRef(false)
  const pasos = useRef(0)
  const actual = useRef(valor)
  const avisarValidez = useRef(alCambiarValidez)
  avisarValidez.current = alCambiarValidez
  const paso =
    pasoExplicito !== undefined && Number.isFinite(pasoExplicito) && pasoExplicito > 0
      ? pasoExplicito
      : unidad === "kg"
        ? subidaKg !== null && subidaKg !== undefined && Number.isFinite(subidaKg) && subidaKg > 0
          ? subidaKg
          : 2.5
        : unidad === "seg"
          ? 5
          : 1
  const limiteInferior = Number.isFinite(minimo) ? Math.max(0, minimo) : 0
  const limiteSuperior = Number.isFinite(maximo)
    ? Math.max(limiteInferior, maximo)
    : Number.MAX_SAFE_INTEGER
  const contexto = useRef({ cambiar, deshabilitado, visible, paso, limiteInferior, limiteSuperior })
  contexto.current = { cambiar, deshabilitado, visible, paso, limiteInferior, limiteSuperior }
  const entrada = useSharedValue(56)
  const opacidad = useSharedValue(0)
  const animado = useAnimatedStyle(() => ({
    opacity: opacidad.value,
    transform: [{ translateY: entrada.value }],
  }))

  const cancelar = (): void => {
    if (temporizador.current !== null) clearTimeout(temporizador.current)
    temporizador.current = null
  }
  const abandonar = (): void => {
    cancelar()
    if (presionActiva.current) gestoCancelado.current = true
    presionActiva.current = false
  }
  useEffect(() => {
    if (manual && valor !== actual.current)
      setTexto(valor !== null && Number.isFinite(valor) ? decimal(valor) : "")
    actual.current = valor
  }, [valor, manual])
  useEffect(() => {
    const mostrar = (evento: KeyboardEvent): void => setTecladoY(evento.endCoordinates.screenY)
    const ocultar = (): void => setTecladoY(null)
    const suscripciones = [
      Keyboard.addListener("keyboardWillShow", mostrar),
      Keyboard.addListener("keyboardDidShow", mostrar),
      Keyboard.addListener("keyboardWillHide", ocultar),
      Keyboard.addListener("keyboardDidHide", ocultar),
    ]
    return () => suscripciones.forEach((suscripcion) => suscripcion.remove())
  }, [])
  useEffect(() => {
    abandonar()
    setManual(false)
    repitio.current = false
    if (!visible || deshabilitado) Keyboard.dismiss()
    return abandonar
  }, [unidad, visible, deshabilitado, paso, limiteInferior, limiteSuperior])
  useEffect(() => {
    cancelAnimation(entrada)
    cancelAnimation(opacidad)
    if (!reducido && visible) {
      entrada.value = 56
      opacidad.value = 0
    }
    entrada.value = reducido
      ? 0
      : visible
        ? withSpring(0, HOJA)
        : withTiming(56, { duration: 160, easing: CURVA.salida })
    opacidad.value = reducido
      ? visible
        ? 1
        : 0
      : withTiming(visible ? 1 : 0, { duration: visible ? 120 : 160, easing: CURVA.salida })
    return () => {
      cancelAnimation(entrada)
      cancelAnimation(opacidad)
    }
  }, [visible, reducido, entrada, opacidad])
  useEffect(() => {
    if (visible) {
      setMontada(true)
      return
    }
    if (reducido) {
      setMontada(false)
      return
    }
    const salida = setTimeout(() => setMontada(false), 160)
    return () => clearTimeout(salida)
  }, [visible, reducido])

  const ajustar = (direccion: number): boolean => {
    const c = contexto.current
    if (c.deshabilitado || !c.visible) return false
    const base =
      actual.current !== null && Number.isFinite(actual.current) ? actual.current : c.limiteInferior
    const siguiente = Math.min(
      c.limiteSuperior,
      Math.max(c.limiteInferior, Number((base + direccion * c.paso).toPrecision(15))),
    )
    if (!Number.isFinite(siguiente) || siguiente === actual.current) return false
    actual.current = siguiente
    setTexto(decimal(siguiente))
    c.cambiar(siguiente)
    pasos.current++
    if (Platform.OS !== "web" && (pasos.current <= 5 || pasos.current % 5 === 0))
      Haptics.selectionAsync().catch(() => undefined)
    return true
  }
  const mantener = (direccion: number): void => {
    cancelar()
    presionActiva.current = true
    gestoCancelado.current = false
    repitio.current = false
    pasos.current = 0
    const repetir = (): void => {
      repitio.current = true
      if (ajustar(direccion))
        temporizador.current = setTimeout(repetir, pasos.current >= 8 ? 60 : 90)
    }
    temporizador.current = setTimeout(repetir, 400)
  }
  const pulsar = (direccion: number): void => {
    cancelar()
    presionActiva.current = false
    if (gestoCancelado.current) {
      gestoCancelado.current = false
      return
    }
    if (repitio.current) {
      repitio.current = false
      return
    }
    pasos.current = 0
    ajustar(direccion)
  }
  const leer = (entradaManual: string): number | null => {
    if (!(unidad === "kg" ? /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/ : /^\d+$/).test(entradaManual))
      return null
    const numero = Number(entradaManual.replace(",", "."))
    return Number.isFinite(numero) && numero >= limiteInferior && numero <= limiteSuperior
      ? numero
      : null
  }
  const invalido = manual && !(texto === "" && alVaciar) && leer(texto) === null
  useEffect(() => {
    alCambiarValidez?.(!invalido)
  }, [alCambiarValidez, invalido])
  useEffect(() => () => avisarValidez.current?.(true), [])
  const listo = (): void => {
    if (deshabilitado || invalido) return
    cancelar()
    Keyboard.dismiss()
    setManual(false)
    alListo()
  }
  if (!montada) return null
  const etiqueta = unidad.toUpperCase()
  const valorLegible = valor !== null && Number.isFinite(valor) ? decimal(valor) : "—"
  const botonPaso = (direccion: -1 | 1): React.JSX.Element => {
    const bloqueado =
      deshabilitado ||
      (valor !== null && (direccion < 0 ? valor <= limiteInferior : valor >= limiteSuperior))
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={direccion < 0 ? "Disminuir" : "Aumentar"}
        accessibilityState={{ disabled: bloqueado }}
        disabled={bloqueado}
        onPressIn={() => mantener(direccion)}
        onPressOut={cancelar}
        onPress={() => pulsar(direccion)}
        onBlur={abandonar}
        onTouchCancel={abandonar}
        style={[s.paso, bloqueado && s.deshabilitado]}
      >
        <Text style={s.signo}>{direccion < 0 ? "−" : "+"}</Text>
      </Pressable>
    )
  }
  const botonListo = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Listo"
      accessibilityState={{ disabled: deshabilitado || invalido }}
      disabled={deshabilitado || invalido}
      onPress={listo}
      style={[s.listo, (deshabilitado || invalido) && s.deshabilitado]}
    >
      <Text style={s.textoListo}>Listo</Text>
    </Pressable>
  )
  return (
    <Animated.View
      testID="barra-ajuste"
      pointerEvents={visible ? "auto" : "none"}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      style={[
        s.contenedor,
        { bottom: margenInferior + (tecladoY === null ? 0 : Math.max(0, altoVentana - tecladoY)) },
        animado,
      ]}
    >
      {encima && <View style={s.encima}>{encima}</View>}
      <View testID="tarjeta-ajuste" style={s.barra}>
        {encabezado}
        {unidad === "rir" ? (
          <>
            <ChipsRir
              valor={valor}
              objetivo={objetivo}
              cambiar={cambiar}
              deshabilitado={deshabilitado}
            />
            {botonListo}
          </>
        ) : (
          <>
            <View style={s.fila}>
              {botonPaso(-1)}
              <View style={s.valor}>
                {manual ? (
                  <TextInput
                    accessibilityLabel={`Valor manual ${etiqueta}`}
                    value={texto}
                    onChangeText={(nuevo) => {
                      setTexto(nuevo)
                      if (nuevo === "" && alVaciar) {
                        actual.current = null
                        alVaciar()
                        return
                      }
                      const numero = leer(nuevo)
                      if (numero !== null) {
                        actual.current = numero
                        cambiar(numero)
                      }
                    }}
                    autoFocus
                    selectTextOnFocus
                    keyboardType={unidad === "kg" ? "decimal-pad" : "number-pad"}
                    editable={!deshabilitado}
                    maxLength={30}
                    selectionColor={tema.acento}
                    style={[s.numero, s.anchoCompleto]}
                    onSubmitEditing={listo}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Escribir ${etiqueta}: ${valorLegible}`}
                    accessibilityHint="Abre el teclado numérico"
                    disabled={deshabilitado}
                    accessibilityState={{ disabled: deshabilitado }}
                    onPress={() => {
                      cancelar()
                      setTexto(valorLegible === "—" ? "" : valorLegible)
                      setManual(true)
                    }}
                    style={s.cifra}
                  >
                    {valorLegible.length > 5 || fontScale > 1.3 ? (
                      <Text
                        testID="ajuste-cifra-adaptable"
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.1}
                        style={[s.numero, s.anchoCompleto]}
                      >
                        {valorLegible}
                      </Text>
                    ) : (
                      <NumeroGiro valor={valorLegible} estilo={s.numero} />
                    )}
                  </Pressable>
                )}
                <Text style={s.etiqueta}>
                  {etiqueta} · paso {decimal(paso)}
                </Text>
              </View>
              {botonPaso(1)}
              {botonListo}
            </View>
            {invalido && (
              <Text accessibilityRole="alert" style={s.error}>
                Introduce un número válido.
              </Text>
            )}
          </>
        )}
      </View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  contenedor: {
    position: "absolute",
    left: 20,
    right: 20,
    marginTop: 12,
  },
  encima: { marginBottom: 12 },
  barra: {
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    backgroundColor: tema.barraAjuste,
    padding: 12,
    gap: 8,
  },
  fila: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  paso: {
    minWidth: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficieAlta,
    borderRadius: radio.celda,
  },
  signo: { color: tema.acento, fontSize: 30, fontFamily: tema.fuenteTexto },
  valor: { flex: 1, minWidth: 0, alignItems: "center", overflow: "hidden" },
  cifra: {
    minHeight: 44,
    minWidth: 44,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  anchoCompleto: { width: "100%" },
  numero: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 30,
    lineHeight: 36,
    textAlign: "center",
    minHeight: 44,
    minWidth: 44,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  etiqueta: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 11,
    letterSpacing: 1.2,
    textAlign: "center",
  },
  listo: {
    minWidth: 52,
    minHeight: 52,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  textoListo: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 13 },
  deshabilitado: { opacity: 0.45 },
  error: { color: tema.aviso, fontFamily: tema.fuenteTexto, fontSize: 13 },
})
