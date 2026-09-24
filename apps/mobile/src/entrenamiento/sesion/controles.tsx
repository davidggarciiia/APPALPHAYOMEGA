import { useState, type ReactNode } from "react"
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native"

import { Icono } from "../../componentes/iconos"
import { degradadoOro, tema } from "../../tema"

/** Pregunta del formulario, en negrita como en el diseño. */
export function Pregunta({
  children,
  valor,
}: {
  children: string
  valor?: string
}): React.JSX.Element {
  return (
    <View style={s.pregunta}>
      <Text style={s.textoPregunta} accessibilityRole="header">
        {children}
      </Text>
      {valor !== undefined && <Text style={s.valorPregunta}>{valor}</Text>}
    </View>
  )
}

/** Fila de opciones de una sola respuesta: «1 2 3 4 5», «0 1 2 3 4 5+». */
export function Opciones<T extends string | number>({
  opciones,
  valor,
  cambiar,
  etiqueta,
  extremos,
  deshabilitado = false,
}: {
  opciones: ReadonlyArray<{ valor: T; texto: string; accesible?: string }>
  valor: T | null
  cambiar: (valor: T) => void
  etiqueta: string
  /** Textos bajo los extremos: «Agotado» y «A tope». */
  extremos?: [string, string]
  deshabilitado?: boolean
}): React.JSX.Element {
  return (
    <View style={s.bloque}>
      <View style={s.opciones} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
        {opciones.map((opcion) => {
          const elegida = opcion.valor === valor
          return (
            <Pressable
              key={String(opcion.valor)}
              accessibilityRole="radio"
              accessibilityLabel={opcion.accesible ?? opcion.texto}
              accessibilityState={{ checked: elegida, disabled: deshabilitado }}
              disabled={deshabilitado}
              onPress={() => cambiar(opcion.valor)}
              style={[s.opcion, elegida && [s.opcionElegida, degradadoOro]]}
            >
              <Text style={[s.textoOpcion, elegida && s.textoElegido]}>{opcion.texto}</Text>
            </Pressable>
          )
        })}
      </View>
      {extremos && (
        <View style={s.extremos} accessible={false}>
          <Text style={s.extremo}>{extremos[0]}</Text>
          <Text style={s.extremo}>{extremos[1]}</Text>
        </View>
      )}
    </View>
  )
}

/** Píldoras: una respuesta («Todo bien / Algo incómodo») o varias («Qué notas»). */
export function Chips<T extends string>({
  opciones,
  elegidas,
  cambiar,
  etiqueta,
  varias = false,
}: {
  opciones: ReadonlyArray<{ valor: T; texto: string }>
  elegidas: ReadonlyArray<T>
  cambiar: (elegidas: T[]) => void
  etiqueta: string
  varias?: boolean
}): React.JSX.Element {
  return (
    <View
      style={s.chips}
      accessibilityRole={varias ? undefined : "radiogroup"}
      accessibilityLabel={etiqueta}
    >
      {opciones.map((opcion) => {
        const elegida = elegidas.includes(opcion.valor)
        return (
          <Pressable
            key={opcion.valor}
            accessibilityRole={varias ? "checkbox" : "radio"}
            accessibilityLabel={opcion.texto}
            accessibilityState={{ checked: elegida }}
            onPress={() =>
              cambiar(
                varias
                  ? elegida
                    ? elegidas.filter((v) => v !== opcion.valor)
                    : [...elegidas, opcion.valor]
                  : [opcion.valor],
              )
            }
            style={[s.chip, elegida && [s.opcionElegida, degradadoOro]]}
          >
            <Text style={[s.textoChip, elegida && s.textoElegido]}>{opcion.texto}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/**
 * Deslizador de 0 a un máximo, como el del diseño. Se arrastra o se toca; con
 * lector de pantalla se ajusta con las acciones de subir y bajar.
 */
export function Deslizador({
  valor,
  cambiar,
  maximo,
  etiqueta,
}: {
  valor: number
  cambiar: (valor: number) => void
  maximo: number
  etiqueta: string
}): React.JSX.Element {
  const [ancho, setAncho] = useState(0)
  const desde = (evento: GestureResponderEvent): void => {
    if (ancho <= 0) return
    const x = Math.min(Math.max(evento.nativeEvent.locationX, 0), ancho)
    cambiar(Math.round((x / ancho) * maximo))
  }
  const proporcion = maximo === 0 ? 0 : valor / maximo
  return (
    <View
      style={s.deslizador}
      onLayout={(e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={desde}
      onResponderMove={desde}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={etiqueta}
      accessibilityValue={{ min: 0, max: maximo, now: valor, text: `${valor} de ${maximo}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "increment") cambiar(Math.min(maximo, valor + 1))
        if (e.nativeEvent.actionName === "decrement") cambiar(Math.max(0, valor - 1))
      }}
    >
      <View style={s.pista} pointerEvents="none">
        <View style={[s.relleno, degradadoOro, { width: `${proporcion * 100}%` }]} />
      </View>
      <View
        pointerEvents="none"
        style={[s.tirador, { left: Math.max(0, proporcion * ancho - 13) }]}
      />
    </View>
  )
}

/** Botón de texto dorado: «Añadir nota», «Ver técnica», «Saltar descanso». */
export function Enlace({
  texto,
  onPress,
  etiqueta,
}: {
  texto: string
  onPress: () => void
  etiqueta?: string
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta ?? texto}
      style={s.enlace}
      hitSlop={6}
    >
      <Text style={s.textoEnlace}>{texto}</Text>
    </Pressable>
  )
}

/** Botón cuadrado de volver o cerrar, arriba a la izquierda. */
export function BotonAtras({
  onPress,
  etiqueta,
}: {
  onPress: () => void
  etiqueta: string
}): React.JSX.Element {
  return (
    <Pressable
      style={s.atras}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
    >
      <Icono nombre="atras" color={tema.texto} />
    </Pressable>
  )
}

/** Botón dorado a lo ancho: «Empezar», «Enviar a tu entrenador». */
export function BotonDorado({
  texto,
  onPress,
  ocupado = false,
}: {
  texto: string
  onPress: () => void
  ocupado?: boolean
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [s.dorado, (pressed || ocupado) && s.pulsado]}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ busy: ocupado, disabled: ocupado }}
      disabled={ocupado}
      onPress={onPress}
    >
      <Text style={s.textoDorado}>{ocupado ? "..." : texto}</Text>
    </Pressable>
  )
}

/** Diálogo de confirmación del diseño: pregunta, explicación y dos botones. */
export function Dialogo({
  visible,
  titulo,
  texto,
  confirmar,
  cancelar,
  alConfirmar,
  alCancelar,
  peligro = false,
  children,
}: {
  visible: boolean
  titulo: string
  texto: string
  confirmar: string
  cancelar: string
  alConfirmar: () => void
  alCancelar: () => void
  peligro?: boolean
  children?: ReactNode
}): React.JSX.Element {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={alCancelar}>
      <View style={s.velo}>
        <View style={s.dialogo} accessibilityViewIsModal>
          <Text style={s.tituloDialogo} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={s.textoDialogo}>{texto}</Text>
          {children}
          <Pressable
            style={peligro ? s.peligro : s.dorado}
            accessibilityRole="button"
            accessibilityLabel={confirmar}
            onPress={alConfirmar}
          >
            <Text style={[s.textoDorado, peligro && s.textoPeligro]}>{confirmar}</Text>
          </Pressable>
          <Pressable
            style={s.secundario}
            accessibilityRole="button"
            accessibilityLabel={cancelar}
            onPress={alCancelar}
          >
            <Text style={s.textoSecundario}>{cancelar}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  pregunta: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  textoPregunta: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16, flex: 1 },
  valorPregunta: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 16 },
  bloque: { gap: 8 },
  opciones: { flexDirection: "row", gap: 8 },
  opcion: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  opcionElegida: { borderColor: "transparent" },
  textoOpcion: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 16 },
  textoElegido: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton },
  extremos: { flexDirection: "row", justifyContent: "space-between" },
  extremo: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    justifyContent: "center",
  },
  textoChip: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  deslizador: { height: 44, justifyContent: "center" },
  pista: { height: 6, borderRadius: 3, backgroundColor: tema.superficieAlta, overflow: "hidden" },
  relleno: { height: 6 },
  tirador: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: tema.texto,
    top: 9,
  },
  enlace: { minHeight: 44, justifyContent: "center" },
  textoEnlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  atras: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  dorado: {
    ...degradadoOro,
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  pulsado: { opacity: 0.8 },
  textoDorado: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 16 },
  velo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,5,4,.7)",
    padding: 16,
  },
  dialogo: {
    backgroundColor: tema.superficie,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  tituloDialogo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  textoDialogo: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  peligro: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: tema.error,
  },
  textoPeligro: { color: tema.sobreAcento },
  secundario: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  textoSecundario: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
})
