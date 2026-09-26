import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { faltaDe, type Falta } from "../lib/errores"
import { useSesion } from "../sesion"

import type { Instantanea, SesionEnCurso } from "./sesion-en-curso"
import { abrirSesionEnCurso } from "./sesiones-abiertas"

export type EstadoDePantalla =
  { fase: "cargando" } | { fase: "error"; falta: Falta } | { fase: "lista"; sesion: SesionEnCurso }

const NADA: Instantanea | null = null

export function useSesionEnCurso(
  cuenta: string | null,
  sesionId: string | null,
): { estado: EstadoDePantalla; instantanea: Instantanea | null; reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoDePantalla>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (cuenta === null || sesionId === null) {
      return
    }
    let vigente = true
    setEstado({ fase: "cargando" })
    abrirSesionEnCurso(cuenta, sesionId)
      .then((sesion) => {
        if (vigente) setEstado({ fase: "lista", sesion })
      })
      .catch((error: unknown) => {
        if (vigente) {
          setEstado({
            fase: "error",
            falta: faltaDe(
              error,
              "No hemos podido abrir esta sesión. La primera vez hace falta conexión.",
            ),
          })
        }
      })
    return () => {
      vigente = false
    }
  }, [cuenta, sesionId, intento])

  const sesion = estado.fase === "lista" ? estado.sesion : null
  const suscribir = useCallback(
    (oyente: () => void) => (sesion === null ? () => undefined : sesion.suscribir(oyente)),
    [sesion],
  )
  const leer = useCallback(() => (sesion === null ? NADA : sesion.leer()), [sesion])
  const instantanea = useSyncExternalStore(suscribir, leer, leer)

  // Al recuperar la conexión (del modo local a dentro) se manda lo pendiente.
  const { estado: sesionApp } = useSesion()
  const enLinea = sesionApp.fase === "dentro"
  useEffect(() => {
    if (enLinea && sesion !== null) {
      void sesion.sincronizar()
    }
  }, [enLinea, sesion])

  // Volver a la pantalla es buen momento para mandar lo pendiente.
  useFocusEffect(
    useCallback(() => {
      if (sesion !== null) {
        void sesion.sincronizar()
      }
    }, [sesion]),
  )

  const reintentar = useCallback(() => setIntento((n) => n + 1), [])
  return { estado, instantanea, reintentar }
}
