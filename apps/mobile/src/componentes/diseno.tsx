import type { ReactNode } from "react"
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
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

/**
 * Ancho máximo del contenido. En el móvil no se nota; en una tableta o en el
 * navegador del ordenador (donde suele trabajar el entrenador) evita líneas de
 * lado a lado de la pantalla.
 */
export const contenidoCentrado = { width: "100%", maxWidth: 760, alignSelf: "center" } as const

/** Fondo, brillo y zona segura: el marco de todas las pantallas del diseño. */
export function Pantalla({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <View style={estilos.pantalla}>
      <BrilloDeFondo />
      <SafeAreaView style={estilos.flexible}>{children}</SafeAreaView>
    </View>
  )
}

export function Chevron({ color = tema.textoTenue }: { color?: string }): React.JSX.Element {
  return (
    <View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M9 5l7 7-7 7"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

export type EstadoDeMarca = "hecho" | "en-curso" | "pendiente"

/**
 * El círculo de la izquierda de cada fila de Nutricion.dc.html: verde con la
 * marca si está hecho, aro dorado si está a medias, aro gris si falta. El
 * estado se dice también con texto en la fila; el color solo no basta.
 */
export function MarcaDeEstado({
  estado,
  tamano = 40,
}: {
  estado: EstadoDeMarca
  tamano?: number
}): React.JSX.Element {
  const radio = tamano / 2
  return (
    <View
      style={[
        estilos.marca,
        { width: tamano, height: tamano, borderRadius: radio },
        estado === "pendiente" && estilos.marcaPendiente,
        estado === "en-curso" && estilos.marcaEnCurso,
      ]}
    >
      {estado === "hecho" && (
        <>
          <RellenoVerde radio={radio} />
          <Visto tamano={Math.round(tamano * 0.45)} />
        </>
      )}
      {estado === "en-curso" && <View style={estilos.puntoEnCurso} />}
    </View>
  )
}

/** Las iniciales en un círculo, arriba a la derecha como en el diseño. */
export function Avatar({
  nombre,
  apellidos,
  onPress,
}: {
  nombre: string
  apellidos: string | null
  onPress?: () => void
}): React.JSX.Element {
  const iniciales = `${nombre.charAt(0)}${(apellidos ?? "").charAt(0)}`.toUpperCase()
  return (
    <Pulsable
      onPress={onPress}
      disabled={onPress === undefined}
      style={estilos.avatar}
      accessibilityRole="button"
      accessibilityLabel="Tu cuenta"
    >
      <Text style={estilos.textoAvatar}>{iniciales}</Text>
    </Pulsable>
  )
}

/** El bloque de filas con borde dorado de Nutricion.dc.html. */
export function Lista({
  children,
  destacada = true,
}: {
  children: ReactNode
  destacada?: boolean
}): React.JSX.Element {
  return <View style={[estilos.lista, destacada && estilos.tarjetaDestacada]}>{children}</View>
}

/**
 * Una fila de `Lista`. Lo pulsable es la fila; `children` va debajo y fuera de
 * ella, para poner otro botón sin anidar botones (p. ej. «Cambiar día»).
 */
export function FilaDeLista({
  titulo,
  subtitulo,
  izquierda,
  derecha,
  onPress,
  resaltada = false,
  ultima = false,
  accessibilityLabel,
  children,
}: {
  titulo: string
  subtitulo?: string
  izquierda?: ReactNode
  derecha?: ReactNode
  onPress?: () => void
  resaltada?: boolean
  ultima?: boolean
  accessibilityLabel?: string
  children?: ReactNode
}): React.JSX.Element {
  const contenido = (
    <>
      {izquierda}
      <View style={estilos.textosFila}>
        <Text style={[estilos.tituloFila, resaltada && estilos.tituloResaltado]}>{titulo}</Text>
        {subtitulo !== undefined && <Text style={texto.tenueMedio}>{subtitulo}</Text>}
      </View>
      {derecha === undefined ? onPress !== undefined && <Chevron /> : derecha}
    </>
  )
  return (
    <View style={[estilos.fila, !ultima && estilos.separador]}>
      {onPress === undefined ? (
        <View style={estilos.filaInterior}>{contenido}</View>
      ) : (
        <Pulsable
          onPress={onPress}
          style={estilos.filaInterior}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          {contenido}
        </Pulsable>
      )}
      {children}
    </View>
  )
}

/** Aviso en línea: sin conexión, conflicto, sesión anulada. */
export function Aviso({
  tono = "info",
  children,
}: {
  tono?: "info" | "error"
  children: ReactNode
}): React.JSX.Element {
  return (
    <View
      style={[estilos.aviso, tono === "error" && estilos.avisoError]}
      accessibilityLiveRegion="polite"
    >
      {children}
    </View>
  )
}

/**
 * Campo de texto del diseño: etiqueta encima, siempre visible (nunca solo el
 * placeholder), y el error debajo, anunciado.
 */
export function CampoDeTexto({
  etiqueta,
  error,
  multilinea = false,
  style,
  ...props
}: TextInputProps & {
  etiqueta: string
  error?: string | null
  multilinea?: boolean
}): React.JSX.Element {
  const conError = error !== undefined && error !== null
  return (
    <View style={estilos.campoBloque}>
      <Text style={estilos.etiquetaCampo}>{etiqueta}</Text>
      <TextInput
        style={[
          estilos.campo,
          multilinea && estilos.campoMultilinea,
          conError && estilos.campoConError,
          style,
        ]}
        placeholderTextColor={tema.marcador}
        accessibilityLabel={etiqueta}
        aria-invalid={conError}
        multiline={multilinea}
        textAlignVertical={multilinea ? "top" : "center"}
        {...props}
      />
      {conError && (
        <Text style={estilos.errorCampo} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  )
}

/**
 * Pastilla que se elige (un grupo muscular, un día, un filtro). Con
 * `accessibilityRole` de radio o checkbox según se elija una o varias.
 */
export function Pastilla({
  texto: etiqueta,
  elegida,
  onPress,
  varias = false,
  compacta = false,
  accessibilityLabel,
}: {
  texto: string
  elegida: boolean
  onPress: () => void
  varias?: boolean
  /** Para una letra (días de la semana): ancho fijo y los siete caben en fila. */
  compacta?: boolean
  accessibilityLabel?: string
}): React.JSX.Element {
  return (
    <Pulsable
      onPress={onPress}
      style={[
        estilos.pastilla,
        compacta && estilos.pastillaCompacta,
        elegida && estilos.pastillaElegida,
      ]}
      accessibilityRole={varias ? "checkbox" : "radio"}
      accessibilityState={{ checked: elegida }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4 }}
    >
      {elegida && (
        <LinearGradient
          colors={degradados.oro}
          locations={degradados.paradas}
          start={DIAGONAL.inicio}
          end={DIAGONAL.fin}
          style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
        />
      )}
      <Text style={[estilos.textoPastilla, elegida && estilos.textoPastillaElegida]}>
        {etiqueta}
      </Text>
    </Pulsable>
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
  marca: { color: tema.texto, fontFamily: fuentes.semi, fontSize: 15 },
  cuerpo: { color: tema.texto, fontFamily: fuentes.normal, fontSize: 15, lineHeight: 21 },
  fuerte: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 17 },
  tenue: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 13, lineHeight: 18 },
  tenueMedio: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 14, lineHeight: 19 },
  tenueGrande: { color: tema.textoTenue, fontFamily: fuentes.normal, fontSize: 15, lineHeight: 21 },
  oro: { color: tema.oro, fontFamily: fuentes.negrita, fontSize: 15 },
})

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  flexible: { flex: 1 },
  textosFila: { flex: 1, gap: 2 },
  marca: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  marcaPendiente: { borderWidth: 2, borderColor: tema.aro },
  marcaEnCurso: { borderWidth: 2, borderColor: tema.oro },
  puntoEnCurso: { width: 10, height: 10, borderRadius: 5, backgroundColor: tema.oro },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1F1D19",
    alignItems: "center",
    justifyContent: "center",
  },
  textoAvatar: { color: tema.oro, fontFamily: fuentes.negrita, fontSize: 18 },
  lista: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  fila: { paddingVertical: 4 },
  filaInterior: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingVertical: 8,
  },
  separador: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  tituloFila: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 17 },
  tituloResaltado: { color: tema.oro },
  aviso: {
    borderWidth: 1,
    borderColor: tema.bordeOro,
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  avisoError: { borderColor: tema.error },
  campoBloque: { gap: 8 },
  etiquetaCampo: { color: tema.textoTenue, fontFamily: fuentes.media, fontSize: 14 },
  campo: {
    minHeight: 52,
    borderRadius: 14,
    // Un tono por encima de la tarjeta, para que el campo se vea también dentro.
    backgroundColor: tema.superficieAlta,
    color: tema.texto,
    fontFamily: fuentes.normal,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  campoMultilinea: { minHeight: 110 },
  campoConError: { borderWidth: 1.5, borderColor: tema.error },
  errorCampo: { color: tema.error, fontFamily: fuentes.normal, fontSize: 14 },
  pastilla: {
    minHeight: 40,
    borderRadius: 999,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: tema.superficieAlta,
    overflow: "hidden",
  },
  pastillaCompacta: { width: 40, paddingHorizontal: 0 },
  pastillaElegida: { backgroundColor: "transparent" },
  textoPastilla: { color: tema.texto, fontFamily: fuentes.semi, fontSize: 14 },
  textoPastillaElegida: { color: tema.sobreOro },
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
    // Un tono por encima de la tarjeta: el botón se ve también dentro de una.
    backgroundColor: tema.superficieAlta,
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
