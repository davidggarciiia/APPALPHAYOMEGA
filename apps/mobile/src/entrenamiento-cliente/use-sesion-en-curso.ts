import { randomUUID } from "expo-crypto"
import { useFocusEffect } from "expo-router"
import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

import { faltaDe, type Falta } from "../lib/errores"

import * as almacen from "./almacen-borradores"
import * as api from "./api"
import { SesionEnCurso, type Dependencias, type Instantanea } from "./sesion-en-curso"

const dependencias: Dependencias = {
  api,
  almacen,
  nuevoId: () => randomUUID(),
  ahora: () => new Date(),
  programar: (tarea, milisegundos) => {
    const reloj = setTimeout(tarea, milisegundos)
    return () => clearTimeout(reloj)
  },
}

/**
 * Una sola instancia por cuenta y sesión: la pantalla de la semana y la del
 * entreno comparten la misma cola de guardado.
 */
const abiertas = new Map<string, Promise<SesionEnCurso>>()

export function abrirSesionEnCurso(cuenta: string, sesionId: string): Promise<SesionEnCurso> {
  const clave = `${cuenta}:${sesionId}`
  let abierta = abiertas.get(clave)
  if (abierta === undefined) {
    abierta = SesionEnCurso.abrir(cuenta, sesionId, dependencias)
    abiertas.set(clave, abierta)
    abierta.catch(() => abiertas.delete(clave))
  }
  return abierta
}

/** Al salir de la cuenta: nada abierto sigue guardando ni sincronizando. */
export function cerrarSesionesEnCurso(): void {
  for (const abierta of abiertas.values()) {
    void abierta.then((sesion) => sesion.cerrar()).catch(() => undefined)
  }
  abiertas.clear()
}

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
