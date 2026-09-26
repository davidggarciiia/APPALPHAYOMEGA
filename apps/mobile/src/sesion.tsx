import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { AppState } from "react-native"
import type { Credenciales, Sesion, UsuarioPublico } from "@alpha-omega/shared"

import { borrarDatosDeCuenta } from "./entrenamiento-cliente/almacen-borradores"
import { cerrarSesionesEnCurso } from "./entrenamiento-cliente/sesiones-abiertas"
import { borrarTokenRefresco, guardarTokenRefresco, leerTokenRefresco } from "./lib/almacen-seguro"
import {
  ErrorDeSesion,
  cerrarSesionEnServidor,
  iniciarSesion as pedirSesion,
  refrescarSesion,
} from "./lib/api"
import { borrarIdentidadLocal, guardarIdentidadLocal, leerIdentidadLocal } from "./lib/sesion-local"
import { conectarSesion } from "./lib/transporte"

/**
 * - `local`: no hay red al abrir la app y la ultima cuenta era de un cliente.
 *   Solo puede seguir con las sesiones de entrenamiento que ya descargo; el
 *   servidor no le concede nada hasta que vuelva la conexion.
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
 *
 * Mientras la app esta abierta, la sesion se renueva sola: cuando el servidor
 * rechaza un token de acceso caducado, el transporte (`lib/transporte.ts`) pide
 * aqui una renovacion y repite la peticion. Antes el token solo se renovaba al
 * arrancar, y a los quince minutos cualquier pantalla abierta dejaba de
 * funcionar.
 */
export function ProveedorDeSesion({ children }: { children: ReactNode }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: "comprobando" })
  const [sesionCaducada, setSesionCaducada] = useState(false)
  const [sinConexion, setSinConexion] = useState(false)
  const [intento, setIntento] = useState(0)

  // Lo que la renovacion necesita leer sin esperar a un repintado. El token de
  // refresco se guarda tambien en memoria: si el llavero no admite una
  // escritura, la siguiente renovacion no puede volver al token ya rotado, que
  // el servidor tomaria por una copia robada.
  const tokenAcceso = useRef<string | null>(null)
  const tokenRefresco = useRef<string | null>(null)

  // Cambia cada vez que se entra o se sale. Una renovacion que empezo en otra
  // epoca termina sin tocar nada: sus tokens ya no son de nadie.
  const epoca = useRef(0)

  // De quien es la sesion abierta, para limpiar lo suyo del movil al salir.
  const usuarioId = useRef<string | null>(null)

  const abrir = useCallback((sesion: Sesion): void => {
    tokenAcceso.current = sesion.tokenAcceso
    tokenRefresco.current = sesion.tokenRefresco
    usuarioId.current = sesion.usuario.id
    // Identidad minima para poder seguir entrenando si la proxima vez no hay red.
    void guardarIdentidadLocal(sesion.usuario).catch(() => undefined)
    setEstado({ fase: "dentro", usuario: sesion.usuario, tokenAcceso: sesion.tokenAcceso })
  }, [])

  const olvidar = useCallback((): void => {
    epoca.current += 1
    tokenAcceso.current = null
    tokenRefresco.current = null
  }, [])

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
          await borrarIdentidadLocal()
          setSesionCaducada(true)
        } else {
          // Red o servidor. El token sigue valiendo y se conserva: el usuario
          // podra reintentar sin volver a escribir su contrasena. Un cliente
          // ademas puede seguir con los entrenos que ya descargo.
          const local = await leerIdentidadLocal()
          if (!vigente) return
          if (local !== null && local.rol === "cliente") {
            usuarioId.current = local.id
            setEstado({ fase: "local", usuario: local })
            return
          }
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
        abrir(sesion)
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
  }, [intento, abrir])

  const entrar = useCallback(
    async (credenciales: Credenciales): Promise<void> => {
      const sesion = await pedirSesion(credenciales)

      // Si el llavero no admite la escritura, la sesion sigue siendo valida para
      // esta ejecucion: no se cae el login entero. Lo unico que se pierde es que
      // sobreviva a cerrar la app, y eso no justifica rechazar la entrada.
      await guardarTokenRefresco(sesion.tokenRefresco).catch(() => undefined)

      olvidar()
      setSesionCaducada(false)
      setSinConexion(false)
      abrir(sesion)
    },
    [abrir, olvidar],
  )

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
    // Lo primero, olvidar: una renovacion en vuelo no puede volver a abrir la
    // sesion que se esta cerrando.
    const enMemoria = tokenRefresco.current
    const cuenta = usuarioId.current
    usuarioId.current = null
    olvidar()
    conectarSesion(null)
    // Nada de lo abierto sigue guardando ni sincronizando con esta cuenta.
    cerrarSesionesEnCurso()

    const guardado = enMemoria ?? (await leerTokenRefresco())

    if (guardado !== null) {
      await cerrarSesionEnServidor(guardado).catch(() => undefined)
    }

    // Salir a proposito limpia lo de esta cuenta en el movil: borradores,
    // sesiones descargadas y su clave. Quien entre despues no hereda nada. El
    // inicio avisa antes si queda algo sin sincronizar.
    if (cuenta !== null) {
      await borrarDatosDeCuenta(cuenta).catch(() => undefined)
    }
    await borrarIdentidadLocal()
    await borrarTokenRefresco()
    setSesionCaducada(false)
    setSinConexion(false)
    setEstado({ fase: "fuera" })
  }, [olvidar])

  /**
   * Canjea el token de refresco por una sesion nueva sin salir de la pantalla.
   *
   * La llama el transporte cuando el servidor rechaza un token de acceso, y
   * nunca dos a la vez: el transporte comparte una sola renovacion entre todas
   * las peticiones que caducan juntas.
   */
  const renovar = useCallback(async (): Promise<string> => {
    const epocaDeInicio = epoca.current
    const refresco = tokenRefresco.current ?? (await leerTokenRefresco())

    if (refresco === null) {
      throw new ErrorDeSesion("No hay sesion guardada")
    }

    let sesion: Sesion
    try {
      sesion = await refrescarSesion(refresco)
    } catch (error) {
      // Solo un rechazo del servidor cierra la sesion. Sin red, la sesion sigue
      // guardada y la pantalla ofrece reintentar.
      if (error instanceof ErrorDeSesion && epoca.current === epocaDeInicio) {
        olvidar()
        conectarSesion(null)
        await borrarTokenRefresco()
        // Los borradores de la cuenta se quedan: si vuelve a entrar la misma
        // persona, los recupera. La identidad local si se borra.
        await borrarIdentidadLocal()
        setSesionCaducada(true)
        setEstado({ fase: "fuera" })
      }
      throw error
    }

    if (epoca.current !== epocaDeInicio) {
      throw new ErrorDeSesion("La sesion cambio mientras se renovaba")
    }

    // El token nuevo se guarda ANTES de usarse, por lo mismo que al arrancar: el
    // servidor ya roto y el viejo solo serviria para parecer una copia robada.
    tokenRefresco.current = sesion.tokenRefresco
    await guardarTokenRefresco(sesion.tokenRefresco).catch(() => undefined)

    if (epoca.current !== epocaDeInicio) {
      throw new ErrorDeSesion("La sesion cambio mientras se renovaba")
    }

    abrir(sesion)
    return sesion.tokenAcceso
  }, [abrir, olvidar])

  // El transporte solo puede renovar mientras hay alguien dentro.
  const dentro = estado.fase === "dentro"
  useEffect(() => {
    if (!dentro) {
      conectarSesion(null)
      return
    }

    conectarSesion({ tokenActual: () => tokenAcceso.current, renovar })
    return () => {
      conectarSesion(null)
    }
  }, [dentro, renovar])

  /** Vuelve a intentar restaurar la sesion. Para el caso de "sin conexion". */
  const reintentar = useCallback((): void => {
    setEstado({ fase: "comprobando" })
    setIntento((n) => n + 1)
  }, [])

  /**
   * Del modo local a dentro, sin pasar por "comprobando": eso desmontaria la
   * pantalla del entreno que la persona tiene abierta.
   */
  const reconectar = useCallback(async (): Promise<boolean> => {
    try {
      await renovar()
      return true
    } catch {
      return false
    }
  }, [renovar])

  // En modo local, volver a la app es el momento natural de probar la red.
  const enModoLocal = estado.fase === "local"
  useEffect(() => {
    if (!enModoLocal) {
      return
    }
    const suscripcion = AppState.addEventListener("change", (siguiente) => {
      if (siguiente === "active") {
        void reconectar()
      }
    })
    return () => {
      suscripcion.remove()
    }
  }, [enModoLocal, reconectar])

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
