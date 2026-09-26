import { useIsFocused } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { faltaDe, type Falta } from "../lib/errores"

export const INTERVALO_DE_SONDEO_MS = 5000

export type EstadoDeSondeo<T> =
  | { fase: "cargando" }
  | { fase: "lista"; datos: T; falta: Falta | null }
  | { fase: "error"; falta: Falta }

function useAppActiva(): boolean {
  const [activa, setActiva] = useState(AppState.currentState !== "background")
  useEffect(() => {
    const suscripcion = AppState.addEventListener("change", (estado) =>
      setActiva(estado === "active"),
    )
    return () => suscripcion.remove()
  }, [])
  return activa
}

/**
 * Lee algo del servidor y lo vuelve a leer cada 5 s mientras la pantalla está
 * a la vista y la app en primer plano (SPEC-entrenamiento: el entrenador ve el
 * envío sin recargar).
 *
 * - Nunca hay dos peticiones a la vez: la siguiente se programa cuando acaba la
 *   anterior, así que una red lenta no apila consultas.
 * - Una respuesta de una consulta anterior (otra semana, otra sesión) se tira.
 * - Si una lectura falla con datos ya en pantalla, se quedan y se avisa aparte;
 *   un corte de cobertura no deja al entrenador sin lo que estaba mirando.
 * - Al volver a la pantalla o a la app se lee al momento.
 *
 * `clave` identifica la consulta: si cambia, se empieza de cero.
 */
export function useSondeo<T>(
  clave: string,
  cargar: () => Promise<T>,
  respaldo: string,
): {
  estado: EstadoDeSondeo<T>
  recargar: () => void
  /** Pone datos recién devueltos por una escritura sin esperar a la siguiente lectura. */
  sustituir: (datos: T) => void
} {
  const enfocada = useIsFocused()
  const activa = useAppActiva()
  const [estado, setEstado] = useState<EstadoDeSondeo<T>>({ fase: "cargando" })
  const [intento, setIntento] = useState(0)
  const cargarActual = useRef(cargar)
  cargarActual.current = cargar
  const respaldoActual = useRef(respaldo)
  respaldoActual.current = respaldo
  const claveMostrada = useRef(clave)
  // Sube con cada `sustituir`: una lectura que salió antes de una escritura
  // puede traer lo de antes de ella, y no puede pisar lo nuevo.
  const generacion = useRef(0)

  if (claveMostrada.current !== clave) {
    // Otra consulta: lo de antes no puede quedarse en pantalla ni un fotograma.
    claveMostrada.current = clave
    setEstado({ fase: "cargando" })
  }

  useEffect(() => {
    if (!enfocada || !activa) {
      return
    }
    let vigente = true
    let temporizador: ReturnType<typeof setTimeout> | null = null

    const leer = async (): Promise<void> => {
      const salida = generacion.current
      try {
        const datos = await cargarActual.current()
        if (!vigente) return
        if (salida === generacion.current) {
          setEstado({ fase: "lista", datos, falta: null })
        }
      } catch (error) {
        if (!vigente) return
        const falta = faltaDe(error, respaldoActual.current)
        setEstado((actual) =>
          actual.fase === "lista" ? { ...actual, falta } : { fase: "error", falta },
        )
      }
      if (vigente) {
        temporizador = setTimeout(() => void leer(), INTERVALO_DE_SONDEO_MS)
      }
    }
    void leer()

    return () => {
      vigente = false
      if (temporizador !== null) clearTimeout(temporizador)
    }
  }, [clave, enfocada, activa, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])
  const sustituir = useCallback((datos: T) => {
    generacion.current += 1
    setEstado({ fase: "lista", datos, falta: null })
  }, [])

  return { estado, recargar, sustituir }
}
