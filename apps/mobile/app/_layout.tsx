import { Stack, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useCallback, useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { PantallaDeCarga } from "../src/componentes/pantalla-de-carga"
import { Pulsable } from "../src/componentes/pulsable"
import { useMovimientoReducido } from "../src/lib/movimiento"
import { ProveedorDeSesion, useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/** Rutas a las que se llega sin sesion. Activar y recuperar estan aqui porque,
 *  por definicion, quien activa o rescata su cuenta todavia no tiene ninguna. */
const RUTAS_PUBLICAS = ["login", "activar", "recuperar", "restablecer"]

/** Sin conexión, un cliente solo llega al inicio y a sus entrenos descargados. */
const RUTAS_LOCALES = ["entrenos"]

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
  const movimientoReducido = useMovimientoReducido()
  const [cargaRetirada, setCargaRetirada] = useState(false)
  const retirarCarga = useCallback(() => {
    setCargaRetirada(true)
  }, [])

  useEffect(() => {
    // Sin conexion se queda en la pantalla de reintentar, que no monta el
    // navegador: redirigir desde ahi mandaria al login a quien tiene una sesion
    // guardada y valida, y en web recargaria la app entera.
    if (estado.fase === "comprobando" || sinConexion) {
      return
    }

    const enRutaPublica = RUTAS_PUBLICAS.includes(segmentos[0] ?? "")

    const enRutaLocal = segmentos[0] === undefined || RUTAS_LOCALES.includes(segmentos[0])

    if (estado.fase === "fuera" && !enRutaPublica) {
      router.replace("/login")
    } else if (estado.fase === "dentro" && enRutaPublica) {
      router.replace("/")
    } else if (estado.fase === "local" && !enRutaLocal) {
      router.replace("/entrenos")
    }
  }, [estado, sinConexion, segmentos, router])

  let contenido: React.JSX.Element | null = null

  if (estado.fase === "fuera" && sinConexion) {
    // Se conserva el token guardado: el problema es la red, no la credencial. Por
    // eso se ofrece reintentar en vez de mandar directamente al login.
    contenido = (
      <View style={estilos.centrado}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.aviso}>No hemos podido conectar con el servidor.</Text>
        <Text style={estilos.detalle}>Tu sesión sigue guardada. Comprueba tu conexión.</Text>
        <Pulsable
          style={estilos.boton}
          onPress={() => {
            // Reintentar vuelve a comprobar la sesion, y el logo vuelve a salir.
            setCargaRetirada(false)
            reintentar()
          }}
          accessibilityRole="button"
        >
          <Text style={estilos.textoBoton}>REINTENTAR</Text>
        </Pulsable>
      </View>
    )
  } else if (estado.fase !== "comprobando") {
    contenido = (
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tema.fondo },
          // La transicion entre pantallas es la nativa y no se toca: corre en el
          // lado de la plataforma, conserva el gesto de volver y es la misma que en
          // el resto de apps del movil. Con movimiento reducido pasa a fundido, y el
          // gesto de volver en iOS funde tambien en vez de deslizar la pantalla.
          animation: movimientoReducido ? "fade" : "default",
          animationMatchesGesture: true,
        }}
      />
    )
  }

  // La pantalla de carga va encima y no en lugar del contenido: cuando la
  // comprobacion acaba, lo siguiente se monta debajo y ella se funde por encima.
  // Si lo sustituyera, el cambio seria un corte seco.
  return (
    <View style={estilos.raiz}>
      {contenido}
      {!cargaRetirada && (
        <PantallaDeCarga lista={estado.fase !== "comprobando"} alDesaparecer={retirarCarga} />
      )}
    </View>
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
  raiz: { flex: 1, backgroundColor: tema.fondo },
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
  textoBoton: { color: tema.oro, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
})
