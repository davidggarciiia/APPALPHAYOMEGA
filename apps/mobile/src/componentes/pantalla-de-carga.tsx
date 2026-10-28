import { useCallback, useEffect, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native"
import { useVideoPlayer, VideoView } from "expo-video"

import logo from "../../assets/video/logo-carga.png"
import video from "../../assets/video/logo-carga.mp4"
import { tema } from "../tema"

/** Lo que dura el clip. Pasado un margen sin aviso de fin se da por terminado. */
const DURACION_MS = 1200
const MARGEN_MS = 300
/** Si el clip no ha empezado a este tiempo, se queda el logo quieto y la app sigue. */
const ARRANQUE_MS = 1500
/** Con «reducir movimiento» no hay clip: el logo quieto se deja el tiempo de verlo. */
const QUIETO_MS = 600
const FUNDIDO_MS = 280

/**
 * Intro de arranque en frío con el vídeo del logo. Se cierra con un fundido
 * cuando `lista` (fuentes y sesión resueltas) y la intro han acabado. Nunca
 * retrasa lo primero ni bloquea lo segundo: un vídeo que falla o tarda se
 * sustituye por el logo quieto, que es el último fotograma del clip.
 *
 * Una vez cerrada no pinta nada más. Que no reaparezca depende de montarla en
 * la raíz, que no se desmonta al navegar ni al volver de segundo plano.
 */
export function PantallaDeCarga({ lista }: { lista: boolean }): React.JSX.Element | null {
  const [reducir, setReducir] = useState<boolean | null>(null)
  const [empezo, setEmpezo] = useState(false)
  /** El clip acabó, falló, se saltó o no arrancó a tiempo. */
  const [terminada, setTerminada] = useState(false)
  const [cerrando, setCerrando] = useState(false)
  const [cerrada, setCerrada] = useState(false)
  const opacidad = useRef(new Animated.Value(1)).current
  const terminar = useCallback(() => {
    setTerminada(true)
  }, [])
  const alEmpezar = useCallback(() => {
    setEmpezo(true)
  }, [])

  useEffect(() => {
    let vigente = true
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((valor) => {
        if (vigente) setReducir(valor)
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [])

  useEffect(() => {
    if (reducir !== true) return
    const id = setTimeout(terminar, QUIETO_MS)
    return () => {
      clearTimeout(id)
    }
  }, [reducir, terminar])

  // Tope duro: sin arranque, o sin aviso de fin, la intro se da por acabada.
  useEffect(() => {
    if (terminada) return
    const id = setTimeout(terminar, empezo ? DURACION_MS + MARGEN_MS : ARRANQUE_MS)
    return () => {
      clearTimeout(id)
    }
  }, [terminada, empezo, terminar])

  // El cierre no se revoca: si `lista` volviera a ser falsa, el fundido empezado acaba igual.
  useEffect(() => {
    if (lista && terminada) setCerrando(true)
  }, [lista, terminada])

  useEffect(() => {
    if (!cerrando) return
    const fundido = Animated.timing(opacidad, {
      toValue: 0,
      duration: FUNDIDO_MS,
      useNativeDriver: Platform.OS !== "web",
    })
    fundido.start(({ finished }) => {
      if (finished) setCerrada(true)
    })
    return () => {
      fundido.stop()
    }
  }, [cerrando, opacidad])

  if (cerrada) return null

  return (
    // Durante el fundido deja pasar los toques: si la animación no acabara, no bloquea la app.
    <Animated.View
      testID="pantalla-de-carga"
      style={[
        StyleSheet.absoluteFill,
        estilos.cubierta,
        { opacity: opacidad, pointerEvents: cerrando ? "none" : "auto" },
      ]}
    >
      <View
        style={StyleSheet.absoluteFill}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Alpha & Omega Training, cargando"
      >
        <Image source={logo} style={estilos.llena} resizeMode="contain" accessible={false} />
        {reducir === false && !terminada && (
          <Reproductor alEmpezar={alEmpezar} alTerminar={terminar} />
        )}
        {terminada && !lista && (
          <ActivityIndicator
            testID="indicador-de-carga"
            color={tema.acento}
            style={estilos.indicador}
          />
        )}
      </View>
      {!terminada && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={terminar}
          accessibilityRole="button"
          accessibilityLabel="Saltar introducción"
        />
      )}
    </Animated.View>
  )
}

/** Vive aparte para que con «reducir movimiento» ni se cargue el vídeo. */
function Reproductor({
  alEmpezar,
  alTerminar,
}: {
  alEmpezar: () => void
  alTerminar: () => void
}): React.JSX.Element {
  const jugador = useVideoPlayer(video, (nuevo) => {
    nuevo.muted = true
    nuevo.loop = false
  })

  useEffect(() => {
    if (jugador.status === "error") alTerminar()
    const suscripciones = [
      jugador.addListener("playingChange", ({ isPlaying }) => {
        if (isPlaying) alEmpezar()
      }),
      jugador.addListener("playToEnd", alTerminar),
      jugador.addListener("statusChange", ({ status }) => {
        if (status === "error") alTerminar()
      }),
    ]
    // En web `play()` solo llega a los vídeos ya montados: va aquí, tras montarse VideoView.
    jugador.play()
    return () => {
      for (const suscripcion of suscripciones) suscripcion.remove()
    }
  }, [jugador, alEmpezar, alTerminar])

  return (
    <VideoView player={jugador} nativeControls={false} contentFit="contain" style={estilos.llena} />
  )
}

const estilos = StyleSheet.create({
  cubierta: { backgroundColor: tema.fondo, zIndex: 1000 },
  // Con absoluteFill a secas, la imagen y el vídeo conservan su tamaño propio en web.
  llena: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  indicador: { position: "absolute", bottom: 72, alignSelf: "center" },
})
