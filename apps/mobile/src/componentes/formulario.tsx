import marca from "../../assets/marca.png"
import type { ReactNode } from "react"
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { fondoDeAcceso, tema } from "../tema"

// Los botones viven en su archivo; se reexportan para no tocar los imports de las pantallas.
export { BotonDestructivo, BotonEnlace, BotonPrincipal, BotonSecundario, vibrar } from "./botones"

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
              <Image
                source={marca}
                style={estilos.logo}
                tintColor={tema.acento}
                resizeMode="contain"
                accessibilityLabel="Alpha & Omega"
              />
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
})
