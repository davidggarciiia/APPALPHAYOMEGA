import type { ReactNode } from "react"
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from "react-native"
import Animated, { Easing, FadeIn, SlideInDown, css, cubicBezier } from "react-native-reanimated"

import { Pulsable } from "../componentes/pulsable"
import { useMovimientoReducido } from "../lib/movimiento"
import { degradadoOro, tema } from "../tema"

/**
 * Piezas de las pantallas de reservas y saldo. Todo lo que se pulsa pasa por
 * `Pulsable`, con objetivos de 44 puntos y su nombre accesible en español.
 */

/** Salida fuerte, la misma del resto de la app. */
const SALIDA = cubicBezier(0.23, 1, 0.32, 1)

/**
 * La hoja entra desde abajo con la curva de las hojas de iOS en 300 ms: se abre
 * pocas veces por sesión y el desplazamiento dice de dónde sale. Con movimiento
 * reducido, solo un fundido.
 */
const ENTRADA_HOJA = SlideInDown.duration(300).easing(Easing.bezier(0.32, 0.72, 0, 1))
const ENTRADA_HOJA_REDUCIDA = FadeIn.duration(200)

type TipoBoton = "principal" | "secundario" | "peligro" | "enlace"

export function Boton({
  texto,
  onPress,
  tipo = "principal",
  etiqueta = texto,
  ocupado = false,
  deshabilitado = false,
  expandido,
}: {
  texto: string
  onPress: () => void
  tipo?: TipoBoton
  /** Nombre accesible cuando el texto visible no basta: «Cancelar la reserva del martes». */
  etiqueta?: string
  ocupado?: boolean
  deshabilitado?: boolean
  /** Para los que abren o pliegan una lista. */
  expandido?: boolean
}): React.JSX.Element {
  const inactivo = ocupado || deshabilitado
  return (
    <Pulsable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      // El nombre no cambia mientras se envía: el lector de pantalla sigue sabiendo qué es.
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: inactivo, busy: ocupado, expanded: expandido }}
      hitSlop={tipo === "enlace" ? 8 : undefined}
      style={[estilos.boton, estilosBoton[tipo], inactivo && estilos.inactivo]}
    >
      {ocupado && tipo !== "enlace" ? (
        <ActivityIndicator color={tipo === "principal" ? tema.sobreAcento : tema.acento} />
      ) : (
        <Text style={estilosTextoBoton[tipo]}>{texto}</Text>
      )}
    </Pulsable>
  )
}

/**
 * Una opción de un grupo de una sola respuesta: un día, un hueco, un servicio.
 *
 * La elección cambia el fondo con una transición de 150 ms: se toca decenas de
 * veces, así que el cambio de color basta para explicar qué ha pasado.
 * El color no se reduce con movimiento reducido: no es movimiento.
 */
export function Eleccion({
  texto,
  detalle,
  elegida,
  onPress,
  etiqueta,
  apagada = false,
  deshabilitada = false,
  ancha = false,
}: {
  texto: string
  detalle?: string
  elegida: boolean
  onPress: () => void
  etiqueta?: string
  /** Se ve más tenue (un día sin huecos) pero se puede elegir. */
  apagada?: boolean
  deshabilitada?: boolean
  ancha?: boolean
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      disabled={deshabilitada}
      accessibilityRole="radio"
      accessibilityLabel={etiqueta ?? (detalle ? `${texto}, ${detalle}` : texto)}
      accessibilityState={{ checked: elegida, selected: elegida, disabled: deshabilitada }}
      style={ancha ? estilos.eleccionAncha : undefined}
    >
      <Animated.View
        style={[
          transiciones.color,
          estilos.eleccion,
          ancha && estilos.eleccionAnchaCaja,
          elegida && estilos.eleccionElegida,
          apagada && !elegida && estilos.eleccionApagada,
          deshabilitada && estilos.inactivo,
        ]}
      >
        <Text style={[estilos.textoEleccion, elegida && estilos.textoElegido]}>{texto}</Text>
        {detalle !== undefined && (
          <Text style={[estilos.detalleEleccion, elegida && estilos.textoElegido]}>{detalle}</Text>
        )}
      </Animated.View>
    </Pulsable>
  )
}

/** Grupo de `Eleccion` con su nombre para el lector de pantalla. */
export function Grupo({
  etiqueta,
  children,
  fila = true,
}: {
  etiqueta: string
  children: ReactNode
  fila?: boolean
}): React.JSX.Element {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta}
      style={fila ? estilos.grupoFila : estilos.grupoColumna}
    >
      {children}
    </View>
  )
}

/**
 * Control segmentado: secciones hermanas de una misma pantalla. No se anima el
 * cambio: se pulsa a menudo y las secciones no están una encima de otra.
 */
export function Segmentos<T extends string>({
  opciones,
  activa,
  cambiar,
  etiqueta,
}: {
  opciones: ReadonlyArray<{ valor: T; texto: string; aviso?: number }>
  activa: T
  cambiar: (valor: T) => void
  etiqueta: string
}): React.JSX.Element {
  return (
    <View style={estilos.segmentos} accessibilityRole="tablist" accessibilityLabel={etiqueta}>
      {opciones.map((opcion) => {
        const elegida = opcion.valor === activa
        const aviso = opcion.aviso ?? 0
        return (
          <Pulsable
            key={opcion.valor}
            accessibilityRole="tab"
            accessibilityLabel={
              aviso > 0 ? `${opcion.texto}, ${String(aviso)} pendientes` : opcion.texto
            }
            accessibilityState={{ selected: elegida }}
            onPress={() => cambiar(opcion.valor)}
            style={[estilos.segmento, elegida && estilos.segmentoElegido]}
          >
            <Text
              style={[estilos.textoSegmento, elegida && estilos.textoSegmentoElegido]}
              numberOfLines={1}
            >
              {opcion.texto}
            </Text>
            {aviso > 0 && (
              <View style={estilos.globo}>
                <Text style={estilos.textoGlobo}>{String(aviso)}</Text>
              </View>
            )}
          </Pulsable>
        )
      })}
    </View>
  )
}

/** Título de sección, con un texto a la derecha si hace falta. */
export function Seccion({
  titulo,
  derecha,
  children,
  onLayout,
}: {
  titulo: string
  derecha?: ReactNode
  children?: ReactNode
  onLayout?: (evento: LayoutChangeEvent) => void
}): React.JSX.Element {
  return (
    <View style={estilos.seccion} onLayout={onLayout}>
      <View style={estilos.cabeceraSeccion}>
        <Text style={estilos.tituloSeccion} accessibilityRole="header">
          {titulo}
        </Text>
        {derecha}
      </View>
      {children}
    </View>
  )
}

export function Tarjeta({
  children,
  destacada = false,
  apagada = false,
}: {
  children: ReactNode
  destacada?: boolean
  apagada?: boolean
}): React.JSX.Element {
  return (
    <View style={[estilos.tarjeta, destacada && estilos.destacada, apagada && estilos.apagada]}>
      {children}
    </View>
  )
}

export function Texto({
  children,
  tenue = false,
  fuerte = false,
}: {
  children: ReactNode
  tenue?: boolean
  fuerte?: boolean
}): React.JSX.Element {
  return (
    <Text style={[estilos.texto, tenue && estilos.tenue, fuerte && estilos.fuerte]}>
      {children}
    </Text>
  )
}

/** Mensaje que el lector de pantalla lee en cuanto aparece. */
export function Aviso({
  texto,
  tipo = "error",
}: {
  texto: string
  tipo?: "error" | "aviso" | "exito"
}): React.JSX.Element {
  return (
    <View style={[estilos.aviso, estilosAviso[tipo]]}>
      <Text
        style={[estilos.textoAviso, tipo === "error" && estilos.textoError]}
        accessibilityRole="alert"
        accessibilityLiveRegion={tipo === "error" ? "assertive" : "polite"}
      >
        {texto}
      </Text>
    </View>
  )
}

/** Cargando, o el fallo con su botón de reintentar cuando reintentar sirve. */
export function Estado({
  cargando,
  error,
  reintentar,
  etiqueta,
}: {
  cargando: boolean
  error: { texto: string; reintentable: boolean } | null
  reintentar: () => void
  etiqueta: string
}): React.JSX.Element | null {
  if (cargando) {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator color={tema.acento} accessibilityLabel={etiqueta} />
      </View>
    )
  }
  if (error === null) return null
  return (
    <View style={estilos.estadoError}>
      <Aviso texto={error.texto} />
      {error.reintentable && <Boton texto="Reintentar" tipo="secundario" onPress={reintentar} />}
    </View>
  )
}

/** «− 09:00 +»: un valor que se ajusta a pasos, con acciones para el lector de pantalla. */
export function Contador({
  etiqueta,
  texto,
  menos,
  mas,
  puedeMenos = true,
  puedeMas = true,
}: {
  etiqueta: string
  texto: string
  menos: () => void
  mas: () => void
  puedeMenos?: boolean
  puedeMas?: boolean
}): React.JSX.Element {
  return (
    <View style={estilos.contador}>
      <Text style={estilos.etiquetaContador}>{etiqueta}</Text>
      <View style={estilos.filaContador}>
        <Pulsable
          onPress={menos}
          disabled={!puedeMenos}
          accessibilityRole="button"
          accessibilityLabel={`Menos ${etiqueta.toLowerCase()}`}
          accessibilityState={{ disabled: !puedeMenos }}
          style={[estilos.paso, !puedeMenos && estilos.inactivo]}
        >
          <Text style={estilos.textoPaso}>−</Text>
        </Pulsable>
        <Text
          style={estilos.valorContador}
          accessibilityLabel={`${etiqueta}: ${texto}`}
          accessibilityLiveRegion="polite"
        >
          {texto}
        </Text>
        <Pulsable
          onPress={mas}
          disabled={!puedeMas}
          accessibilityRole="button"
          accessibilityLabel={`Más ${etiqueta.toLowerCase()}`}
          accessibilityState={{ disabled: !puedeMas }}
          style={[estilos.paso, !puedeMas && estilos.inactivo]}
        >
          <Text style={estilos.textoPaso}>+</Text>
        </Pulsable>
      </View>
    </View>
  )
}

export function CampoTexto({
  etiqueta,
  ...props
}: TextInputProps & { etiqueta: string }): React.JSX.Element {
  return (
    <View style={estilos.campoCaja}>
      <Text style={estilos.etiquetaContador}>{etiqueta}</Text>
      <TextInput
        style={estilos.campo}
        placeholderTextColor={tema.marcador}
        selectionColor={tema.acento}
        accessibilityLabel={etiqueta}
        {...props}
      />
    </View>
  )
}

/**
 * Hoja inferior dentro de la pantalla: confirmar una reserva, cancelar, mover.
 *
 * `ocupado` bloquea el botón atrás de Android mientras se guarda; los botones
 * de dentro se bloquean con su propio `ocupado`.
 */
export function Hoja({
  visible,
  titulo,
  alCerrar,
  ocupado = false,
  children,
}: {
  visible: boolean
  titulo: string
  alCerrar: () => void
  ocupado?: boolean
  children: ReactNode
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={ocupado ? () => undefined : alCerrar}
    >
      <View style={estilos.velo}>
        <Animated.View
          entering={reducido ? ENTRADA_HOJA_REDUCIDA : ENTRADA_HOJA}
          style={estilos.hoja}
          accessibilityViewIsModal
        >
          <Text style={estilos.tituloHoja} accessibilityRole="header">
            {titulo}
          </Text>
          <ScrollView
            style={estilos.cuerpoHoja}
            contentContainerStyle={estilos.contenidoHoja}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const transiciones = css.create({
  color: {
    transitionProperty: ["backgroundColor", "borderColor"],
    transitionDuration: 150,
    transitionTimingFunction: SALIDA,
  },
})

const estilos = StyleSheet.create({
  boton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inactivo: { opacity: 0.5 },
  eleccion: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  eleccionAncha: { flexGrow: 1, flexBasis: 140 },
  eleccionAnchaCaja: { alignItems: "flex-start" },
  eleccionElegida: { backgroundColor: tema.acento, borderColor: tema.acento },
  eleccionApagada: { borderColor: tema.borde, backgroundColor: "transparent" },
  textoEleccion: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  detalleEleccion: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 12 },
  textoElegido: { color: tema.sobreAcento },
  grupoFila: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  grupoColumna: { gap: 8 },
  segmentos: {
    flexDirection: "row",
    backgroundColor: tema.superficie,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  // Cada segmento mide lo que su texto y reparte lo que sobra: a 360 puntos
  // «Solicitudes» no cabe en un cuarto del ancho y se cortaría.
  segmento: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "auto",
    minWidth: 0,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  segmentoElegido: { backgroundColor: tema.superficieAlta },
  textoSegmento: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteSemi,
    fontSize: 14,
    flexShrink: 1,
  },
  textoSegmentoElegido: { color: tema.texto, fontFamily: tema.fuenteBoton },
  // En la esquina, sin quitar ancho al texto.
  globo: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tema.acento,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  textoGlobo: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 10 },
  seccion: { gap: 12 },
  cabeceraSeccion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  tituloSeccion: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 22,
    lineHeight: 26,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: tema.borde,
    padding: 16,
    gap: 8,
  },
  destacada: { borderColor: tema.bordeDestacado },
  apagada: { opacity: 0.7 },
  texto: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
  tenue: { color: tema.textoTenue, fontSize: 13, lineHeight: 18 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton },
  aviso: { borderRadius: 14, padding: 14, borderWidth: 1 },
  textoAviso: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 14, lineHeight: 20 },
  textoError: { color: tema.error },
  centrado: { paddingVertical: 32, alignItems: "center" },
  estadoError: { gap: 4 },
  contador: { gap: 6, flexGrow: 1, flexBasis: 150 },
  etiquetaContador: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13 },
  filaContador: { flexDirection: "row", alignItems: "center", gap: 8 },
  paso: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    alignItems: "center",
    justifyContent: "center",
  },
  textoPaso: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  valorContador: {
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 17,
    minWidth: 64,
    flexShrink: 1,
    textAlign: "center",
  },
  campoCaja: { gap: 6 },
  campo: {
    backgroundColor: tema.suave,
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: 12,
    color: tema.texto,
    fontSize: 16,
    fontFamily: tema.fuenteTexto,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  velo: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,5,4,.7)",
  },
  hoja: {
    backgroundColor: tema.superficie,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 12,
    width: "100%",
    maxWidth: 560,
    maxHeight: "90%",
    alignSelf: "center",
  },
  tituloHoja: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  cuerpoHoja: { flexGrow: 0 },
  contenidoHoja: { gap: 12 },
})

const estilosBoton = StyleSheet.create({
  principal: { ...degradadoOro },
  secundario: { borderWidth: 1, borderColor: tema.bordeFuerte },
  peligro: { borderWidth: 1, borderColor: tema.error },
  enlace: { minHeight: 44, paddingHorizontal: 0, alignItems: "flex-start" },
})

const estilosTextoBoton = StyleSheet.create({
  principal: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 16 },
  secundario: { color: tema.texto, fontFamily: tema.fuenteSemi, fontSize: 15 },
  peligro: { color: tema.error, fontFamily: tema.fuenteBoton, fontSize: 15 },
  enlace: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
})

const estilosAviso = StyleSheet.create({
  error: { borderColor: tema.error, backgroundColor: "rgba(224,106,95,.08)" },
  aviso: { borderColor: tema.aviso, backgroundColor: tema.acentoSuave },
  exito: { borderColor: tema.exito, backgroundColor: tema.exitoSuave },
})
