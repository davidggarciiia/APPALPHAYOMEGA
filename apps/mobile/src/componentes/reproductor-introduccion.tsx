import { useEffect } from "react"
import { StyleSheet } from "react-native"
import { useVideoPlayer, VideoView } from "expo-video"

import video from "../../assets/video/logo-carga-lenta.mp4"

export function ReproductorIntroduccion({
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
    jugador.play()
    return () => {
      for (const suscripcion of suscripciones) suscripcion.remove()
    }
  }, [jugador, alEmpezar, alTerminar])
  return <VideoView player={jugador} nativeControls={false} contentFit="contain" style={s.llena} />
}

const s = StyleSheet.create({
  llena: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
})
