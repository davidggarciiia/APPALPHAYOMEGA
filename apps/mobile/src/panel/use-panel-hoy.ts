import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import type { PanelHoy } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { ApiPanel } from "./api"

export type EstadoDelPanel =
  | { fase: "cargando" }
  | { fase: "error"; falta: Falta }
  | {
      fase: "listo"
      datos: PanelHoy
      actualizando: boolean
      /** La última actualización falló; lo que se ve es lo anterior. */
      falta: Falta | null
    }

/**
 * Carga el panel al entrar y cada vez que se vuelve a la pantalla: revisar un
 * entreno y pulsar volver tiene que quitarlo de «Por revisar».
 *
 * Mientras se actualiza se queda lo último que llegó, sin parpadeo. Si la
 * actualización falla se avisa sin borrarlo. Sin nada cargado, un fallo es un
 * error con reintento: nunca se pinta una cifra que no haya dado el servidor.
 */
export function usePanelHoy(api: ApiPanel): { estado: EstadoDelPanel; reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoDelPanel>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setEstado((actual) =>
        actual.fase === "listo" ? { ...actual, actualizando: true } : { fase: "cargando" },
      )
      api
        .hoy()
        .then((datos) => {
          if (vigente) setEstado({ fase: "listo", datos, actualizando: false, falta: null })
        })
        .catch((error: unknown) => {
          if (!vigente) return
          const falta = faltaDe(error, "No hemos podido cargar tu panel.")
          setEstado((actual) =>
            actual.fase === "listo"
              ? { ...actual, actualizando: false, falta }
              : { fase: "error", falta },
          )
        })
      return () => {
        vigente = false
      }
    }, [api, intento]),
  )

  const reintentar = useCallback(() => {
    setIntento((n) => n + 1)
  }, [])
  return { estado, reintentar }
}
