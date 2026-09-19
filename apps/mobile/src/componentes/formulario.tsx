import marca from "../../assets/marca.png"
import type { ReactNode } from "react"
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { tema } from "../tema"

/**
 * Envoltorio de pantalla con formulario.
 *
 * El `ScrollView` dentro del `KeyboardAvoidingView` no es decorativo: en Android
 * el teclado tapaba el boton de enviar y no habia forma de llegar a el. Con esto
 * el contenido se puede desplazar por encima del teclado.
 *
 * `keyboardShouldPersistTaps` en "handled" permite pulsar el boton con el teclado
 * abierto. Sin eso, el primer toque solo cierra el teclado y el usuario cree que
 * el boton no funciona.
 */
export function PantallaDeFormulario({
  children,
  acceso = false,
  sinTarjeta = false,
}: {
  children: ReactNode
  acceso?: boolean
  sinTarjeta?: boolean
}): React.JSX.Element {
  return (
    <SafeAreaView
      edges={acceso ? undefined : ["left", "right"]}
      style={[estilos.pantalla, acceso && estilos.acceso]}
    >
      <KeyboardAvoidingView
        style={estilos.flexible}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[estilos.contenido, acceso && estilos.contenidoAcceso]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {acceso && (
            <View style={estilos.identidad}>
              <Image source={marca} style={estilos.logo} accessibilityLabel="Alpha & Omega" />
              <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
              <Text style={estilos.lema}>TRAINING</Text>
            </View>
          )}
          <View style={!sinTarjeta && estilos.tarjeta}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function Campo({
  etiqueta,
  error,
  ...props
}: TextInputProps & { etiqueta: string; error?: string }): React.JSX.Element {
  return (
    <>
      <Text style={estilos.etiqueta}>{etiqueta.toUpperCase()}</Text>
      <TextInput
        style={estilos.campo}
        placeholderTextColor={tema.textoTenue}
        accessibilityLabel={etiqueta}
        // Los lectores de pantalla necesitan saber que el campo tiene un error,
        // no basta con pintarlo en rojo debajo.
        aria-invalid={error !== undefined}
        {...props}
      />
      {error !== undefined && (
        <Text style={estilos.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </>
  )
}

export function BotonPrincipal({
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
      style={({ pressed }) => [estilos.boton, (pressed || ocupado) && estilos.botonPulsado]}
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      // El nombre accesible no cambia mientras se envia. Antes el boton se
      // quedaba sin texto y un lector de pantalla no sabia que anunciar.
      accessibilityLabel={texto}
      accessibilityState={{ disabled: ocupado, busy: ocupado }}
    >
      <Text style={estilos.textoBoton}>{ocupado ? "..." : texto}</Text>
    </Pressable>
  )
}

/**
 * Acción secundaria: cancelar, volver, reenviar.
 *
 * Cuando todos los
 * botones de una pantalla se ven igual, el que da de baja a alguien se pulsa por
 * error tarde o temprano.
 */
export function BotonSecundario({
  texto,
  etiquetaAccesible = texto,
  onPress,
  ocupado = false,
  deshabilitado = false,
}: {
  texto: string
  etiquetaAccesible?: string
  onPress: () => void
  ocupado?: boolean
  deshabilitado?: boolean
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        estilos.secundario,
        (pressed || ocupado || deshabilitado) && estilos.botonPulsado,
      ]}
      onPress={onPress}
      disabled={ocupado || deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible}
      accessibilityState={{ disabled: ocupado || deshabilitado, busy: ocupado }}
    >
      <Text style={estilos.textoSecundario}>{ocupado ? "..." : texto}</Text>
    </Pressable>
  )
}

/** Acción con consecuencias, identificada por su texto y separada de guardar. */
export function BotonDestructivo({
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
      style={({ pressed }) => [estilos.destructivo, (pressed || ocupado) && estilos.botonPulsado]}
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: ocupado, busy: ocupado }}
    >
      <Text style={estilos.textoDestructivo}>{ocupado ? "..." : texto}</Text>
    </Pressable>
  )
}

export function AvisoDeError({ mensaje }: { mensaje: string }): React.JSX.Element {
  return (
    <Text
      style={estilos.errorGeneral}
      accessibilityRole="alert"
      // Hace que el lector de pantalla lo lea en cuanto aparece, sin que el
      // usuario tenga que ir a buscarlo.
      accessibilityLiveRegion="assertive"
    >
      {mensaje}
    </Text>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  flexible: { flex: 1 },
  contenido: { flexGrow: 1, padding: 16, width: "100%", maxWidth: 820, alignSelf: "center" },
  acceso: { backgroundColor: tema.cabecera },
  contenidoAcceso: { justifyContent: "center", maxWidth: 460, paddingVertical: 32 },
  identidad: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 116,
    height: 116,
    tintColor: tema.sobreAcento,
    resizeMode: "contain",
    marginBottom: 12,
  },
  marca: {
    color: tema.sobreAcento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 32,
    letterSpacing: 4,
    fontWeight: "700",
    textAlign: "center",
  },
  lema: {
    color: "#BDBDBD",
    fontSize: 12,
    letterSpacing: 8,
    marginTop: 4,
    marginBottom: 0,
    textAlign: "center",
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  etiqueta: {
    color: tema.textoSecundario,
    fontSize: 11,
    letterSpacing: 0.7,
    marginBottom: 6,
    marginTop: 12,
  },
  campo: {
    backgroundColor: tema.fondo,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 14,
    color: tema.texto,
    fontSize: 16,
    fontFamily: tema.fuenteTexto,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: { color: tema.error, fontSize: 12, marginTop: 6 },
  errorGeneral: { color: tema.error, fontSize: 14, marginTop: 16, textAlign: "center" },
  boton: {
    backgroundColor: tema.acento,
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  botonPulsado: { opacity: 0.75 },
  textoBoton: {
    color: tema.sobreAcento,
    fontFamily: tema.fuenteBoton,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  secundario: {
    maxWidth: "100%",
    flexShrink: 1,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  textoSecundario: {
    textAlign: "center",
    color: tema.texto,
    fontFamily: tema.fuenteBoton,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.7,
  },
  destructivo: {
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  textoDestructivo: { color: tema.error, fontSize: 13, fontWeight: "700", letterSpacing: 0.7 },
})
