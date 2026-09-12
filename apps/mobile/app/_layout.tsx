import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"

import { ProveedorDeSesion, useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * Manda al login a quien no tiene sesion y saca del login a quien si la tiene.
 *
 * Vive aqui, en la raiz, y no dentro de cada pantalla: una comprobacion por
 * pantalla se olvida en la pantalla numero doce.
 */
function Enrutador(): React.JSX.Element {
  const { estado } = useSesion()
  const segmentos = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (estado.fase === "comprobando") {
      return
    }

    const enLogin = segmentos[0] === "login"

    if (estado.fase === "fuera" && !enLogin) {
      router.replace("/login")
    } else if (estado.fase === "dentro" && enLogin) {
      router.replace("/")
    }
  }, [estado, segmentos, router])

  if (estado.fase === "comprobando") {
    return (
      <View style={estilos.cargando}>
        <ActivityIndicator color={tema.oro} size="large" />
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
  cargando: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
  },
})
