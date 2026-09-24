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

import { degradadoOro, fondoDeAcceso, tema } from "../tema"

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
          <View style={[!sinTarjeta && estilos.tarjeta, acceso && estilos.tarjetaAcceso]}>
            {children}
          </View>
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
      <Text style={estilos.etiqueta}>{etiqueta}</Text>
      <TextInput
        style={estilos.campo}
        placeholderTextColor={tema.marcador}
        selectionColor={tema.acento}
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
  pantalla: { flex: 1, backgroundColor: "transparent" },
  flexible: { flex: 1 },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
  acceso: fondoDeAcceso,
  tarjetaAcceso: { backgroundColor: "transparent", padding: 4 },
  contenidoAcceso: { justifyContent: "center", maxWidth: 460, paddingVertical: 32 },
  identidad: { alignItems: "center", marginBottom: 28 },
  logo: {
    width: 96,
    height: 96,
    tintColor: tema.acento,
    resizeMode: "contain",
    marginBottom: 16,
  },
  marca: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  lema: {
    color: tema.acento,
    fontFamily: tema.fuenteSemi,
    fontSize: 12,
    letterSpacing: 8,
    marginTop: 4,
    textAlign: "center",
  },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 20 },
  etiqueta: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    marginBottom: 8,
    marginTop: 16,
  },
  campo: {
    backgroundColor: tema.suave,
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: 12,
    color: tema.texto,
    fontSize: 16,
    fontFamily: tema.fuenteTexto,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { color: tema.error, fontFamily: tema.fuenteTexto, fontSize: 13, marginTop: 6 },
  errorGeneral: {
    color: tema.error,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
    marginTop: 16,
    textAlign: "center",
  },
  boton: {
    ...degradadoOro,
    borderRadius: 14,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  botonPulsado: { opacity: 0.8 },
  textoBoton: {
    color: tema.sobreAcento,
    fontFamily: tema.fuenteBoton,
    fontSize: 16,
    textAlign: "center",
  },
  secundario: {
    maxWidth: "100%",
    flexShrink: 1,
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  textoSecundario: {
    textAlign: "center",
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 15,
  },
  destructivo: {
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  textoDestructivo: { color: tema.error, fontFamily: tema.fuenteBoton, fontSize: 15 },
})
