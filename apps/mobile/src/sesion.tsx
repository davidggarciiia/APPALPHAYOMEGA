import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { AppState } from "react-native"
import type { Credenciales, UsuarioPublico } from "@alpha-omega/shared"

import { borrarDatosDeCuenta } from "./entrenamiento-cliente/almacen-borradores"
import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import { ErrorDeSesion, cerrarSesionEnServidor, iniciarSesion as pedirSesion } from "./lib/api"
import {
  escucharCredenciales,
  establecerCredenciales,
  olvidarCredenciales,
  renovarAcceso,
} from "./lib/credenciales"
import { borrarIdentidadLocal, guardarIdentidadLocal, leerIdentidadLocal } from "./lib/sesion-local"

/**
 * - `local`: no hay red al abrir la app y la última cuenta era de un cliente.
 *   Solo puede seguir con las sesiones que ya descargó; el servidor no le
 *   concede nada hasta que vuelva la conexión.
 */
export type EstadoSesion =
  | { fase: "comprobando" }
  | { fase: "fuera" }
  | { fase: "dentro"; usuario: UsuarioPublico; tokenAcceso: string }
  | { fase: "local"; usuario: UsuarioPublico }

type Contexto = {
  estado: EstadoSesion
  /** El servidor rechazo la sesion guardada y hubo que descartarla. */
  sesionCaducada: boolean
  /** No se pudo hablar con el servidor al arrancar. El token sigue guardado. */
  sinConexion: boolean
  entrar: (credenciales: Credenciales) => Promise<void>
  salir: () => Promise<void>
  reintentar: () => void
  /** Desde el modo local, vuelve a hablar con el servidor sin desmontar la pantalla abierta. */
  reconectar: () => Promise<boolean>
}

const ContextoSesion = createContext<Contexto | null>(null)

/**
 * Estado de sesion de toda la app.
 *
 * El token de acceso vive solo en memoria, a proposito: dura quince minutos y no
 * gana nada con sobrevivir al cierre de la app. El de refresco es el unico que se
 * guarda, y va al llavero del sistema.
 *
 * La regla que gobierna este fichero, y que costo cara aprender: **el token
 * guardado solo se borra cuando el servidor lo rechaza**. Un fallo de red, un
 * error del servidor o un llavero roto no son motivo para destruir una sesion
 * valida de treinta dias. Antes se borraba ante cualquier excepcion, asi que
 * abrir la app en el metro sin cobertura te dejaba fuera de forma permanente.
 */
export function ProveedorDeSesion({ children }: { children: ReactNode }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: "comprobando" })
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [intento, setIntento] = useState(0)

  // Toda renovación, la haga quien la haga, actualiza el token del estado. Las
  // pantallas que dependen de `tokenAcceso` vuelven a pedir sus datos una vez y
  // se recuperan, en lugar de quedarse en "sesión caducada".
  useEffect(
    () =>
      escucharCredenciales((evento) => {
        if (evento.tipo === "renovada") {
          setSinConexion(false)
          setSesionCaducada(false)
          setEstado({
            fase: "dentro",
            usuario: evento.sesion.usuario,
            tokenAcceso: evento.sesion.tokenAcceso,
          })
        } else {
          setSesionCaducada(true)
          setEstado({ fase: "fuera" })
        }
      }),
    [],
  )

  useEffect(() => {
    let vigente = true

    const restaurar = async (): Promise<void> => {
      setSinConexion(false)

      // `leerTokenRefresco` no lanza: ante un llavero roto devuelve null y borra
      // la entrada. Si propagara, la app se quedaria en "comprobando" para
      // siempre y reabrirla repetiria el mismo fallo.
      const guardado = await leerTokenRefresco()

      if (guardado === null) {
        if (vigente) setEstado({ fase: "fuera" })
        return
      }

      try {
        // La misma puerta que usan las pantallas: nunca dos renovaciones a la vez.
        await renovarAcceso(null)
      } catch (error) {
        if (!vigente) return

        if (error instanceof ErrorDeSesion) {
          // Este es el unico caso en el que el token deja de servir: caducado,
          // revocado, o la cuenta desactivada. `renovarAcceso` ya lo borro.
          setSesionCaducada(true)
          setEstado({ fase: "fuera" })
          return
        }

        // Red o servidor. El token sigue valiendo y se conserva. Un cliente puede
        // seguir con lo que ya descargo; el resto espera a reintentar.
        const local = await leerIdentidadLocal()
        if (!vigente) return
        if (local !== null && local.rol === "cliente") {
          setEstado({ fase: "local", usuario: local })
          return
        }
        setSinConexion(true)
        setEstado({ fase: "fuera" })
      }
    }

    // Red de seguridad: ninguna rama puede dejar el estado en "comprobando", que
    // en pantalla es una ruleta girando sin salida.
    void restaurar().catch(() => {
      if (vigente) setEstado({ fase: "fuera" })
    })

    return () => {
      vigente = false
    }
  }, [intento])

  // En modo local, volver a la app es el momento natural de probar la red.
  const enModoLocal = estado.fase === "local"
  useEffect(() => {
    if (!enModoLocal) {
      return
    }
    const suscripcion = AppState.addEventListener("change", (siguiente) => {
      if (siguiente === "active") {
        void renovarAcceso(null).catch(() => undefined)
      }
    })
    return () => {
      suscripcion.remove()
    }
  }, [enModoLocal])

  const entrar = useCallback(async (credenciales: Credenciales): Promise<void> => {
    const sesion = await pedirSesion(credenciales)
    establecerCredenciales(sesion)

    // Si el llavero no admite la escritura, la sesion sigue siendo valida para
    // esta ejecucion: no se cae el login entero. Lo unico que se pierde es que
    // sobreviva a cerrar la app, y eso no justifica rechazar la entrada.
    await guardarTokenRefresco(sesion.tokenRefresco).catch(() => undefined)
    await guardarIdentidadLocal(sesion.usuario).catch(() => undefined)

    setSesionCaducada(false)
    setSinConexion(false)
    setEstado({ fase: "dentro", usuario: sesion.usuario, tokenAcceso: sesion.tokenAcceso })
  }, [])

  /**
   * Cierra la sesion.
   *
   * Sale localmente pase lo que pase. Antes, un fallo de red hacia que el boton
   * no hiciera nada visible y el token se quedara en el llavero: el usuario creia
   * haber cerrado sesion y no era cierto, que es peor que cualquier error.
   *
   * Si no se pudo avisar al servidor, la sesion sigue viva alli hasta que caduque.
   * No es ideal, pero dejar al usuario dentro contra su voluntad es peor.
   */
  const salir = useCallback(async (): Promise<void> => {
    const usuarioId = estado.fase === "dentro" || estado.fase === "local" ? estado.usuario.id : null
    await olvidarCredenciales()
    const guardado = await leerTokenRefresco()

    if (guardado !== null) {
      await cerrarSesionEnServidor(guardado).catch(() => undefined)
    }

    // Salir a propósito limpia lo de esta cuenta en el móvil: borradores, sesiones
    // descargadas y su clave. Quien entre después no hereda nada.
    if (usuarioId !== null) {
      await borrarDatosDeCuenta(usuarioId).catch(() => undefined)
    }
    await borrarIdentidadLocal()
    await borrarTokenRefresco()
    setSesionCaducada(false)
    setSinConexion(false)
    setEstado({ fase: "fuera" })
  }, [estado])

  /** Vuelve a intentar restaurar la sesion. Para el caso de "sin conexion". */
  const reintentar = useCallback((): void => {
    setEstado({ fase: "comprobando" })
    setIntento((n) => n + 1)
  }, [])

  const reconectar = useCallback(async (): Promise<boolean> => {
    try {
      await renovarAcceso(null)
      return true
    } catch {
      return false
    }
  }, [])

  const valor = useMemo<Contexto>(
    () => ({ estado, sesionCaducada, sinConexion, entrar, salir, reintentar, reconectar }),
    [estado, sesionCaducada, sinConexion, entrar, salir, reintentar, reconectar],
  )

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}

export function useSesion(): Contexto {
  const contexto = useContext(ContextoSesion)

  if (contexto === null) {
    throw new Error("useSesion se ha usado fuera de ProveedorDeSesion")
  }

  return contexto
}
