import { useCallback, useState } from "react"
import { useFocusEffect } from "expo-router"
import { AppState } from "react-native"
import { ResumenSemanalSchema, type ResumenSemanal } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

/**
 * Cada cuánto se repite el resumen de toda la cartera mientras la pantalla está
 * visible y la app activa. Pide el agregado de todos los clientes, así que no
 * compensa hacerlo cada pocos segundos: además se refresca al volver a la
 * pantalla, al volver de segundo plano y a mano.
 */
export const REFRESCO_RESUMEN_MS = 60_000

export function useResumenSemanal(
  pedir: PeticionAutenticada,
  semana: string,
): {
  datos: ResumenSemanal | null
  error: Falta | null
  /** Hay una consulta en vuelo (primera carga o refresco). */
  actualizando: boolean
  reintentar: () => void
  /** Vuelve a pedir el resumen ya, sin vaciar lo que se ve. */
  refrescar: () => void
} {
  const [datos, setDatos] = useState<ResumenSemanal | null>(null)
  const [error, setError] = useState<Falta | null>(null)
  const [intento, setIntento] = useState(0)
  const [actualizando, setActualizando] = useState(false)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      let activa = AppState.currentState === null || AppState.currentState === "active"
      let consulta: AbortController | null = null
      let temporizador: ReturnType<typeof setTimeout> | undefined
      setError(null)
      const detener = (): void => {
        clearTimeout(temporizador)
        consulta?.abort()
        consulta = null
        if (vigente) setActualizando(false)
      }
      const cargar = async (): Promise<void> => {
        if (!vigente || !activa || consulta) return
        const actual = new AbortController()
        consulta = actual
        setActualizando(true)
        let continuar = true
        try {
          const resumen = await pedir(
            `/entrenamiento/resumen-semanal?semana=${encodeURIComponent(semana)}`,
            ResumenSemanalSchema,
            { signal: actual.signal },
          )
          if (vigente && !actual.signal.aborted) {
            setDatos(resumen)
            setError(null)
          }
        } catch (causa: unknown) {
          if (vigente && !actual.signal.aborted) {
            const falta = faltaDe(causa, "No se pudo cargar el resumen semanal.")
            setError(falta)
            continuar = falta.reintentable
            if (!continuar) setDatos(null)
          }
        } finally {
          if (consulta === actual) {
            consulta = null
            if (vigente) setActualizando(false)
            if (vigente && activa && continuar)
              temporizador = setTimeout(() => void cargar(), REFRESCO_RESUMEN_MS)
          }
        }
      }
      void cargar()
      const actividad = AppState.addEventListener("change", (estado) => {
        const estabaActiva = activa
        activa = estado === "active"
        if (!activa) detener()
        else if (!estabaActiva) void cargar()
      })
      return () => {
        vigente = false
        detener()
        actividad.remove()
      }
    }, [pedir, semana, intento]),
  )
  return {
    datos: datos?.semana === semana ? datos : null,
    error,
    actualizando,
    reintentar: () => setIntento((n) => n + 1),
    refrescar: () => setIntento((n) => n + 1),
  }
}
