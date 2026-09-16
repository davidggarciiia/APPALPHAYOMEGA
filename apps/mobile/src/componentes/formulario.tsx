import type { ReactNode } from "react"
import {
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
export function PantallaDeFormulario({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView
        style={estilos.flexible}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={estilos.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
          <Text style={estilos.lema}>TRAINING</Text>
          <View style={estilos.tarjeta}>{children}</View>
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
 * Existe porque hasta ahora solo había un botón, el de oro. Cuando todos los
 * botones de una pantalla se ven igual, el que da de baja a alguien se pulsa por
 * error tarde o temprano.
 */
export function BotonSecundario({
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
      style={({ pressed }) => [estilos.secundario, (pressed || ocupado) && estilos.botonPulsado]}
      onPress={onPress}
      disabled={ocupado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: ocupado, busy: ocupado }}
    >
      <Text style={estilos.textoSecundario}>{ocupado ? "..." : texto}</Text>
    </Pressable>
  )
}

/** Acción con consecuencias. Va en rojo y nunca al lado de guardar. */
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
  contenido: { flexGrow: 1, justifyContent: "center", padding: 24 },
  marca: {
    color: tema.oro,
    fontSize: 24,
    letterSpacing: 4,
    fontWeight: "700",
    textAlign: "center",
  },
  lema: {
    color: tema.textoTenue,
    fontSize: 12,
    letterSpacing: 8,
    marginTop: 4,
    marginBottom: 40,
    textAlign: "center",
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
  etiqueta: {
    color: tema.oroSuave,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 12,
  },
  campo: {
    backgroundColor: tema.fondo,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    color: tema.texto,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: { color: tema.error, fontSize: 12, marginTop: 6 },
  errorGeneral: { color: tema.error, fontSize: 14, marginTop: 16, textAlign: "center" },
  boton: {
    backgroundColor: tema.oro,
    borderRadius: 8,
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPulsado: { opacity: 0.75 },
  textoBoton: { color: tema.fondo, fontSize: 14, fontWeight: "700", letterSpacing: 2 },
  secundario: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  textoSecundario: { color: tema.texto, fontSize: 13, fontWeight: "600", letterSpacing: 2 },
  destructivo: {
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  textoDestructivo: { color: tema.error, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
})
