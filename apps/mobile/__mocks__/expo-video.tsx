import { useState } from "react"
import { View } from "react-native"

/**
 * expo-video necesita su módulo nativo y no carga en Jest. Este sustituto lo usa
 * cualquier suite que pinte una pantalla con figura sin probar el reproductor;
 * las pruebas del reproductor declaran su propio doble con más detalle.
 */
export function useVideoPlayer(): object {
  return useState(() => ({
    status: "loading",
    play: () => undefined,
    pause: () => undefined,
    addListener: () => ({ remove: () => undefined }),
  }))[0]
}

export function VideoView(): React.JSX.Element {
  return <View />
}
