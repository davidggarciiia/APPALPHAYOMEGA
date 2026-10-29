import { useCallback, useEffect, useState } from "react"
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { useVideoPlayer, VideoView } from "expo-video"

import emblema from "../../assets/emblema.png"
import fotograma from "../../assets/video/logo-carga.png"
import video from "../../assets/video/logo-carga.mp4"
import { tema } from "../tema"
import { vibrar } from "./botones"
import { useMovimientoReducido } from "./movimiento"

/** El clip original conserva Ω, Α, el rayo y los anillos sin inventar un vector de marca. */
export function TrazoLogo({
  bucle = false,
  tamano = 96,
  estilo,
}: {
  bucle?: boolean
  tamano?: number
  estilo?: StyleProp<ViewStyle>
}): React.JSX.Element {
  const reducido = useMovimientoReducido()
  const [terminado, fijarTerminado] = useState(false)
  const terminar = useCallback(() => fijarTerminado(true), [])
  useEffect(() => fijarTerminado(false), [bucle])
  useEffect(() => {
    if (bucle) return
    const impacto = setTimeout(() => vibrar("exito"), 750)
    return () => clearTimeout(impacto)
  }, [bucle])
  return (
    <View
      style={[estilos.raiz, { width: tamano, height: tamano }, estilo]}
      accessible
      accessibilityRole={bucle ? "progressbar" : "image"}
      accessibilityLabel={bucle ? "Alpha & Omega, cargando" : "Alpha & Omega"}
    >
      <Image
        testID="trazo-logo-imagen"
        source={reducido ? emblema : fotograma}
        resizeMode="contain"
        accessible={false}
        style={[estilos.llena, reducido && bucle && estilos.quieto]}
      />
      {!reducido && !terminado && <Reproductor bucle={bucle} alTerminar={terminar} />}
    </View>
  )
}

/** Separado para que con movimiento reducido no se cree ni se cargue el vídeo. */
function Reproductor({
  bucle,
  alTerminar,
}: {
  bucle: boolean
  alTerminar: () => void
}): React.JSX.Element {
  const [empezo, fijarEmpezo] = useState(false)
  const jugador = useVideoPlayer(video, (nuevo) => {
    nuevo.muted = true
    nuevo.loop = bucle
  })
  useEffect(() => {
    if (jugador.status === "error") alTerminar()
    const suscripciones = [
      jugador.addListener("playingChange", ({ isPlaying }) => {
        if (isPlaying) fijarEmpezo(true)
      }),
      jugador.addListener("playToEnd", () => {
        if (!bucle) alTerminar()
      }),
      jugador.addListener("statusChange", ({ status }) => {
        if (status === "error") alTerminar()
      }),
    ]
    jugador.loop = bucle
    jugador.play()
    return () => {
      for (const suscripcion of suscripciones) suscripcion.remove()
      // useVideoPlayer libera el recurso; parar aquí también cubre el cambio del ajuste.
      try {
        jugador.pause()
      } catch {
        /* El hook puede haber liberado ya el reproductor. */
      }
    }
  }, [jugador, bucle, alTerminar])
  useEffect(() => {
    if (empezo && bucle) return
    // Mismo margen de pantalla-de-carga: ni un fallo de arranque ni un fin perdido deja un vídeo colgado.
    const limite = setTimeout(alTerminar, 1500)
    return () => clearTimeout(limite)
  }, [empezo, bucle, alTerminar])
  return (
    <VideoView player={jugador} nativeControls={false} contentFit="contain" style={estilos.llena} />
  )
}

const estilos = StyleSheet.create({
  raiz: { backgroundColor: tema.fondo, overflow: "hidden" },
  llena: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  quieto: { opacity: 0.6 },
})
