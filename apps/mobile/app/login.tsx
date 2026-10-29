import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "expo-router"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { CredencialesSchema, type Credenciales } from "@alpha-omega/shared"
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Svg, { Circle, Path } from "react-native-svg"

import emblema from "../assets/emblema.png"
import { EntradaMarca } from "../src/componentes/entrada-marca"
import { AvisoDeError, BotonEnlace, BotonPrincipal, Campo } from "../src/componentes/formulario"
import { ErrorDeRed, ErrorDeSesion } from "../src/lib/api"
import { useEnvioUnico } from "../src/lib/envio-unico"
import { useSesion } from "../src/sesion"
import { alto, espacio, fondoDeAcceso, tema } from "../src/tema"

export default function Login(): React.JSX.Element {
  const { entrar, sesionCaducada } = useSesion()
  const router = useRouter()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [mostrarContrasena, fijarMostrarContrasena] = useState(false)

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
      // aqui lo que se protegio alli.
      if (error instanceof ErrorDeSesion) {
        setErrorGeneral("Correo o contraseña incorrectos")
      } else if (error instanceof ErrorDeRed) {
        setErrorGeneral("No hemos podido conectar. Revisa tu conexión.")
      } else {
        setErrorGeneral("Algo ha fallado en el servidor. Inténtalo en un momento.")
      }
    }
  })
  const enviarUnaVez = useEnvioUnico(enviar)

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView
        style={s.flexible}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={s.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <EntradaMarca style={s.identidad}>
            <Image source={emblema} style={s.emblema} resizeMode="contain" accessible={false} />
            <Text accessibilityRole="header" style={s.marca}>
              ALPHA &amp; OMEGA
            </Text>
          </EntradaMarca>
          <EntradaMarca indice={1}>
            {sesionCaducada && <AvisoDeError mensaje="Tu sesión ha caducado. Entra otra vez." />}
            {errorGeneral !== null && <AvisoDeError mensaje={errorGeneral} />}

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Campo
                  etiqueta="Correo"
                  soloPlaceholder
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="Correo"
                  error={errors.email !== undefined ? "Correo no válido" : undefined}
                />
              )}
            />

            <View style={s.clave}>
              <Controller
                control={control}
                name="contrasena"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Campo
                    etiqueta="Contraseña"
                    soloPlaceholder
                    style={s.campoClave}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    secureTextEntry={!mostrarContrasena}
                    autoComplete="current-password"
                    placeholder="Contraseña"
                    returnKeyType="go"
                    onSubmitEditing={enviarUnaVez}
                    error={errors.contrasena !== undefined ? "Escribe tu contraseña" : undefined}
                  />
                )}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}
                accessibilityState={{ checked: mostrarContrasena }}
                onPress={() => fijarMostrarContrasena((valor) => !valor)}
                style={s.ojo}
              >
                <View aria-hidden>
                  <Svg
                    width={22}
                    height={22}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={tema.textoTenue}
                    strokeWidth={1.6}
                  >
                    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                    <Circle cx={12} cy={12} r={3} />
                    {mostrarContrasena && <Path d="M4 3l16 18" />}
                  </Svg>
                </View>
              </Pressable>
            </View>

            <BotonPrincipal texto="ENTRAR" onPress={enviarUnaVez} ocupado={isSubmitting} />

            <BotonEnlace
              texto="HE OLVIDADO MI CONTRASEÑA"
              onPress={() => router.push("/recuperar")}
            />
          </EntradaMarca>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  pantalla: { flex: 1, ...fondoDeAcceso },
  flexible: { flex: 1 },
  contenido: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: espacio[20],
    paddingVertical: espacio[32],
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  identidad: { alignItems: "center", gap: espacio[16], marginBottom: espacio[28] },
  emblema: { width: 56, height: 70 },
  marca: {
    fontFamily: tema.fuenteTitulo,
    fontSize: 40,
    lineHeight: 44,
    color: tema.acento,
    textAlign: "center",
  },
  clave: { position: "relative" },
  campoClave: { paddingRight: 56 },
  ojo: {
    position: "absolute",
    top: espacio[20],
    right: espacio[4],
    width: alto.tactil,
    height: alto.tactil,
    alignItems: "center",
    justifyContent: "center",
  },
})
