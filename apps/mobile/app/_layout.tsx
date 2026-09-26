import anton from "../assets/fonts/Anton-Regular.ttf"
import archivo from "../assets/fonts/Archivo-Regular.ttf"
import archivoSemi from "../assets/fonts/Archivo-SemiBold.ttf"
import archivoBold from "../assets/fonts/Archivo-Bold.ttf"
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import { useCallback, useEffect, useMemo, useState } from "react"
import { StyleSheet, Text, View } from "react-native"

import { ProveedorDeSesion, useSesion } from "../src/sesion"
import { degradadoOro, fondoDeMarca, tema } from "../src/tema"
import { Armazon } from "../src/componentes/armazon"
import { PantallaDeCarga } from "../src/componentes/pantalla-de-carga"
import { Pulsable } from "../src/componentes/pulsable"
import { crearApiConsentimiento, PuertaConsentimiento } from "../src/consentimiento"
import { useMovimientoReducido } from "../src/lib/movimiento"

/** Rutas a las que se llega sin sesion. Activar y recuperar estan aqui porque,
 *  por definicion, quien activa o rescata su cuenta todavia no tiene ninguna. */
const RUTAS_PUBLICAS = ["login", "activar", "recuperar", "restablecer"]

/**
 * Manda al login a quien no tiene sesion y saca del login a quien si la tiene.
 *
 * Vive aqui, en la raiz, y no dentro de cada pantalla: una comprobacion por
 * pantalla se olvida en la pantalla numero doce.
 */
function Enrutador({ fuentesListas }: { fuentesListas: boolean }): React.JSX.Element {
  const { estado, sinConexion, reintentar, pedir, salir } = useSesion()
  const consentimiento = useMemo(() => crearApiConsentimiento(pedir), [pedir])
  const segmentos = useSegments()
  const router = useRouter()
  const movimientoReducido = useMovimientoReducido()
  const [cargaRetirada, setCargaRetirada] = useState(false)
  const retirarCarga = useCallback(() => {
    setCargaRetirada(true)
  }, [])
  const esperandoRed = estado.fase === "fuera" && sinConexion

  useEffect(() => {
    // Sin conexion se queda en la pantalla de reintentar, que no monta el
    // navegador: redirigir desde ahi mandaria al login a quien tiene una sesion
    // guardada y valida, y en web recargaria la app entera.
    if (estado.fase === "comprobando" || esperandoRed) {
      return
    }

    const enRutaPublica = RUTAS_PUBLICAS.includes(segmentos[0] ?? "")

    if (estado.fase === "fuera" && !enRutaPublica) {
      router.replace("/login")
    } else if (estado.fase === "dentro" && enRutaPublica) {
      router.replace("/")
    } else if (
      estado.fase === "local" &&
      segmentos[0] !== "entrenamiento" &&
      segmentos[0] !== "nutricion"
    ) {
      router.replace("/entrenamiento")
    }
  }, [estado, esperandoRed, segmentos, router])

  let contenido: React.JSX.Element | null = null

  if (esperandoRed) {
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
    const pila = (
      <Armazon>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
            // La transicion entre pantallas es la nativa: corre en la plataforma,
            // conserva el gesto de volver y es la misma que en el resto de apps.
            // Con movimiento reducido pasa a fundido, y el gesto de volver en
            // iOS funde tambien en vez de deslizar la pantalla.
            animation: movimientoReducido ? "fade" : "default",
            animationMatchesGesture: true,
          }}
        />
      </Armazon>
    )
    // Un cliente da su consentimiento de datos de salud antes de usar la app.
    contenido = (
      <ThemeProvider value={TEMA_DE_NAVEGACION}>
        {estado.fase === "dentro" && estado.usuario.rol === "cliente" ? (
          <PuertaConsentimiento
            key={estado.usuario.id}
            api={consentimiento}
            salir={() => void salir()}
          >
            {pila}
          </PuertaConsentimiento>
        ) : (
          pila
        )}
      </ThemeProvider>
    )
  }

  // La pantalla de carga va encima y no en lugar del contenido: cuando la
  // comprobacion acaba, lo siguiente se monta debajo y ella se funde por encima.
  // Si lo sustituyera, el cambio seria un corte seco. Si las fuentes fallan, la
  // app sigue con las del sistema: un tipo de letra no deja a nadie fuera.
  return (
    <View style={estilos.raiz}>
      {fuentesListas && contenido}
      {!cargaRetirada && (
        <PantallaDeCarga
          lista={estado.fase !== "comprobando" && fuentesListas}
          alDesaparecer={retirarCarga}
        />
      )}
    </View>
  )
}

/**
 * El tema claro por defecto de la navegación pinta cada pantalla apilada de gris
 * claro (rgb 242) por encima del fondo de marca: el tema oscuro, transparente.
 */
const TEMA_DE_NAVEGACION = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "transparent",
    card: tema.cabecera,
    text: tema.texto,
    primary: tema.acento,
    border: tema.borde,
  },
}

/** Todo el diseño es oscuro: la barra de estado va siempre en claro. */
function BarraDeEstado(): React.JSX.Element {
  return <StatusBar style="light" />
}

export default function DisposicionRaiz(): React.JSX.Element {
  const [fuentes, errorFuentes] = useFonts({
    Anton: anton,
    Archivo: archivo,
    ArchivoSemiBold: archivoSemi,
    ArchivoBold: archivoBold,
  })
  return (
    <ProveedorDeSesion>
      <BarraDeEstado />
      <Enrutador fuentesListas={fuentes || errorFuentes !== null} />
    </ProveedorDeSesion>
  )
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: tema.fondo },
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    ...fondoDeMarca,
  },
  marca: {
    color: tema.acento,
    fontFamily: tema.fuenteTitulo,
    fontSize: 22,
    letterSpacing: 4,
    marginBottom: 32,
  },
  aviso: { color: tema.texto, fontSize: 16, textAlign: "center" },
  detalle: { color: tema.textoTenue, fontSize: 13, textAlign: "center", marginTop: 8 },
  boton: {
    ...degradadoOro,
    borderRadius: 14,
    marginTop: 28,
    minHeight: 52,
    paddingHorizontal: 32,
    justifyContent: "center",
  },
  textoBoton: { color: tema.sobreAcento, fontSize: 16, fontWeight: "700" },
})
