import anton from "../assets/fonts/Anton-Regular.ttf"
import archivo from "../assets/fonts/Archivo-Regular.ttf"
import archivoSemi from "../assets/fonts/Archivo-SemiBold.ttf"
import archivoBold from "../assets/fonts/Archivo-Bold.ttf"
import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useFonts } from "expo-font"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

import { ProveedorDeSesion, useSesion } from "../src/sesion"
import { degradadoOro, fondoDeMarca, tema } from "../src/tema"
import { Armazon } from "../src/componentes/armazon"
import { PantallaDeCarga } from "../src/componentes/pantalla-de-carga"
import { envolverPantalla } from "../src/componentes/transicion-pantalla"
import { crearApiConsentimiento, PuertaConsentimiento } from "../src/consentimiento"

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
  const { estado, sinConexion, reintentar, pedir, salir } = useSesion()
  const consentimiento = useMemo(() => crearApiConsentimiento(pedir), [pedir])
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
    } else if (
      estado.fase === "local" &&
      segmentos[0] !== "entrenamiento" &&
      segmentos[0] !== "nutricion"
    ) {
      router.replace("/entrenamiento")
    }
  }, [estado, segmentos, router])

  if (estado.fase === "comprobando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator
          color={tema.acento}
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

  const pila = (
    <Armazon>
      <Stack
        screenLayout={envolverPantalla}
        screenOptions={{
          headerShown: false,
          animation: "none",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Armazon>
  )
  // Un cliente da su consentimiento de datos de salud antes de usar la app.
  return (
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

function EsperaDeSesion({ alComprobar }: { alComprobar: (lista: boolean) => void }): null {
  const { estado } = useSesion()
  useEffect(() => {
    alComprobar(estado.fase !== "comprobando")
  }, [estado.fase, alComprobar])
  return null
}

export default function DisposicionRaiz(): React.JSX.Element {
  const [sesionComprobada, fijarSesionComprobada] = useState(false)
  const [fuentes, errorFuentes] = useFonts({
    Anton: anton,
    Archivo: archivo,
    ArchivoSemiBold: archivoSemi,
    ArchivoBold: archivoBold,
  })
  const fuentesListas = fuentes || !!errorFuentes
  // La sesión se comprueba a la vez que se cargan las fuentes: la pantalla de
  // carga cubre ambas esperas y solo se retira cuando las dos han acabado.
  return (
    <>
      <ProveedorDeSesion>
        <StatusBar style="light" />
        {fuentesListas && <Enrutador />}
        <EsperaDeSesion alComprobar={fijarSesionComprobada} />
      </ProveedorDeSesion>
      {/* La intro vive fuera del árbol que se remonta al cambiar de cuenta. */}
      <PantallaDeCarga lista={fuentesListas && sesionComprobada} />
    </>
  )
}

const estilos = StyleSheet.create({
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    ...fondoDeMarca,
  },
  // Sin fuentes propias todavía: la carga de fuentes puede no haber terminado.
  marca: {
    color: tema.acento,
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: "700",
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
  botonPulsado: { opacity: 0.85 },
  textoBoton: { color: tema.sobreAcento, fontSize: 16, fontWeight: "700" },
})
