import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

import { ProveedorDeSesion, useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/** Rutas a las que se llega sin sesion. Activar y recuperar estan aqui porque,
 *  por definicion, quien activa o rescata su cuenta todavia no tiene ninguna. */
const RUTAS_PUBLICAS = ["login", "activar", "recuperar", "restablecer"]

/**
 * Manda al login a quien no tiene sesion y saca del login a quien si la tiene.
 *
 * Vive aqui, en la raiz, y no dentro de cada pantalla: una comprobacion por
 * pantalla se olvida en la pantalla numero doce.
 */
function Enrutador(): React.JSX.Element {
  const { estado, sinConexion, reintentar } = useSesion()
  const segmentos = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (estado.fase === "comprobando") {
      return
    }

    const enRutaPublica = RUTAS_PUBLICAS.includes(segmentos[0] ?? "")

    if (estado.fase === "fuera" && !enRutaPublica) {
      router.replace("/login")
    } else if (estado.fase === "dentro" && enRutaPublica) {
      router.replace("/")
    }
  }, [estado, segmentos, router])

  if (estado.fase === "comprobando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator
          color={tema.oro}
          size="large"
          accessibilityLabel="Comprobando tu sesión"
        />
      </View>
    )
  }

  // Se conserva el token guardado: el problema es la red, no la credencial. Por
  // eso se ofrece reintentar en vez de mandar directamente al login.
  if (estado.fase === "fuera" && sinConexion) {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.aviso}>No hemos podido conectar con el servidor.</Text>
        <Text style={estilos.detalle}>Tu sesión sigue guardada. Comprueba tu conexión.</Text>
        <Pressable
          style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
          onPress={reintentar}
          accessibilityRole="button"
        >
          <Text style={estilos.textoBoton}>REINTENTAR</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tema.fondo },
      }}
    />
  )
}

export default function DisposicionRaiz(): React.JSX.Element {
  return (
    <ProveedorDeSesion>
      <StatusBar style="light" />
      <Enrutador />
    </ProveedorDeSesion>
  )
}

const estilos = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
    padding: 24,
  },
  marca: { color: tema.oro, fontSize: 20, letterSpacing: 4, fontWeight: "700", marginBottom: 32 },
  aviso: { color: tema.texto, fontSize: 16, textAlign: "center" },
  detalle: { color: tema.textoTenue, fontSize: 13, textAlign: "center", marginTop: 8 },
  boton: {
    borderColor: tema.oro,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  botonPulsado: { opacity: 0.6 },
  textoBoton: { color: tema.oro, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
})
