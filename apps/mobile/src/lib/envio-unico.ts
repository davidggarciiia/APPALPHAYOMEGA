import { useRef } from "react"

/**
 * Impide lanzar dos veces a la vez una acción asíncrona. El «Go» del teclado
 * (`onSubmitEditing`) no respeta el `ocupado` del botón: dos pulsaciones seguidas
 * lanzaban dos envíos, y el segundo invalidaba la sesión del primero.
 */
export function useEnvioUnico(accion: () => Promise<unknown>): () => void {
  const enCurso = useRef(false)
  return () => {
    if (enCurso.current) return
    enCurso.current = true
    void accion().finally(() => {
      enCurso.current = false
    })
  }
}
