import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CredencialesSchema, type Credenciales } from "@alpha-omega/shared"

import { ErrorDeSesion } from "../src/lib/api"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

export default function Login(): React.JSX.Element {
  const { entrar } = useSesion()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credenciales>({
    resolver: zodResolver(CredencialesSchema),
    defaultValues: { email: "", contrasena: "" },
  })

  const enviar = handleSubmit(async (credenciales) => {
    setErrorGeneral(null)

    try {
      await entrar(credenciales)
    } catch (error) {
      // Un mismo mensaje para credenciales mal y para correo inexistente. El
      // servidor ya no los distingue; la app tampoco debe hacerlo, o se pierde
      // ahi lo que se protegio alli.
      setErrorGeneral(
        error instanceof ErrorDeSesion
          ? "Correo o contraseña incorrectos"
          : "No se ha podido conectar. Revisa tu conexión.",
      )
    }
  })

  return (
    <SafeAreaView style={estilos.pantalla}>
      <KeyboardAvoidingView
        style={estilos.centro}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.lema}>TRAINING</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.etiqueta}>CORREO</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estilos.campo}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="tu@correo.com"
                placeholderTextColor={tema.textoTenue}
                accessibilityLabel="Correo electrónico"
              />
            )}
          />
          {errors.email !== undefined && <Text style={estilos.error}>Correo no válido</Text>}

          <Text style={estilos.etiqueta}>CONTRASEÑA</Text>
          <Controller
            control={control}
            name="contrasena"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={estilos.campo}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="current-password"
                placeholder="••••••••"
                placeholderTextColor={tema.textoTenue}
                accessibilityLabel="Contraseña"
              />
            )}
          />
          {errors.contrasena !== undefined && (
            <Text style={estilos.error}>Escribe tu contraseña</Text>
          )}

          {errorGeneral !== null && <Text style={estilos.errorGeneral}>{errorGeneral}</Text>}

          <Pressable
            style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
            onPress={() => void enviar()}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color={tema.fondo} />
            ) : (
              <Text style={estilos.textoBoton}>ENTRAR</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  centro: { flex: 1, justifyContent: "center", padding: 24 },
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
})
