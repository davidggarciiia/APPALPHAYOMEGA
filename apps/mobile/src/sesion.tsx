import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { Credenciales, Sesion, UsuarioPublico } from "@alpha-omega/shared"

import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import {
  ErrorDeSesion,
  cerrarSesionEnServidor,
  iniciarSesion as pedirSesion,
  refrescarSesion,
} from "./lib/api"

type EstadoSesion =
  | { fase: "comprobando" }
  | { fase: "fuera" }
  | { fase: "dentro"; usuario: UsuarioPublico; tokenAcceso: string }

type Contexto = {
  estado: EstadoSesion
  /** El servidor rechazo la sesion guardada y hubo que descartarla. */
  sesionCaducada: boolean
  /** No se pudo hablar con el servidor al arrancar. El token sigue guardado. */
  sinConexion: boolean
  entrar: (credenciales: Credenciales) => Promise<void>
  salir: () => Promise<void>
  reintentar: () => void
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

      let sesion: Sesion
      try {
        sesion = await refrescarSesion(guardado)
      } catch (error) {
        if (!vigente) return

        if (error instanceof ErrorDeSesion) {
          // Este es el unico caso en el que el token deja de servir: caducado,
          // revocado, o la cuenta desactivada. Se borra para no reintentarlo.
          await borrarTokenRefresco()
          setSesionCaducada(true)
        } else {
          // Red o servidor. El token sigue valiendo y se conserva: el usuario
          // podra reintentar sin volver a escribir su contrasena.
          setSinConexion(true)
        }

        setEstado({ fase: "fuera" })
        return
      }

      // El token nuevo se guarda ANTES de dar la sesion por buena. Si la app
      // muriera entre ambas cosas, el servidor ya habria rotado y al volver
      // mandariamos el viejo, que el servidor interpreta como una copia robada.
      await guardarTokenRefresco(sesion.tokenRefresco)

      if (vigente) {
        setSesionCaducada(false)
        setEstado({ fase: "dentro", usuario: sesion.usuario, tokenAcceso: sesion.tokenAcceso })
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

  const entrar = useCallback(async (credenciales: Credenciales): Promise<void> => {
    const sesion = await pedirSesion(credenciales)

    // Si el llavero no admite la escritura, la sesion sigue siendo valida para
    // esta ejecucion: no se cae el login entero. Lo unico que se pierde es que
    // sobreviva a cerrar la app, y eso no justifica rechazar la entrada.
    await guardarTokenRefresco(sesion.tokenRefresco).catch(() => undefined)

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
    const guardado = await leerTokenRefresco()

    if (guardado !== null) {
      await cerrarSesionEnServidor(guardado).catch(() => undefined)
    }

    await borrarTokenRefresco()
    setSesionCaducada(false)
    setSinConexion(false)
    setEstado({ fase: "fuera" })
  }, [])

  /** Vuelve a intentar restaurar la sesion. Para el caso de "sin conexion". */
  const reintentar = useCallback((): void => {
    setEstado({ fase: "comprobando" })
    setIntento((n) => n + 1)
  }, [])

  const valor = useMemo<Contexto>(
    () => ({ estado, sesionCaducada, sinConexion, entrar, salir, reintentar }),
    [estado, sesionCaducada, sinConexion, entrar, salir, reintentar],
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
