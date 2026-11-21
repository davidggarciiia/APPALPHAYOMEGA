import { getSourceUri } from "expo-video/build/VideoPlayer.web"

import video from "../../assets/video/logo-carga-lenta.mp4"

/** El autoplay del navegador no deja una promesa play() pendiente al saltar la intro. */
export function ReproductorIntroduccion({
  alEmpezar,
  alTerminar,
}: {
  alEmpezar: () => void
  alTerminar: () => void
}): React.JSX.Element {
  return (
    <video
      src={getSourceUri(video) ?? undefined}
      autoPlay
      muted
      playsInline
      preload="auto"
      controls={false}
      aria-hidden
      tabIndex={-1}
      onPlaying={alEmpezar}
      onEnded={alTerminar}
      onError={alTerminar}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
    />
  )
}
