import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import type { Credenciales, UsuarioPublico } from "@alpha-omega/shared"

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
  entrar: (credenciales: Credenciales) => Promise<void>
  salir: () => Promise<void>
}

const ContextoSesion = createContext<Contexto | null>(null)

/**
 * Estado de sesion de toda la app.
 *
 * El token de acceso vive solo en memoria, a proposito: dura quince minutos y no
 * gana nada con sobrevivir al cierre de la app. El de refresco es el unico que se
 * guarda, y va al llavero del sistema.
 *
 * Al arrancar, si hay token de refresco guardado se canjea por una sesion nueva.
 * Eso es lo que hace que cerrar y reabrir la app no pida la contrasena otra vez.
 */
export function ProveedorDeSesion({ children }: { children: ReactNode }): React.JSX.Element {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: "comprobando" })

  const aplicar = useCallback(
    async (sesion: { usuario: UsuarioPublico; tokenAcceso: string; tokenRefresco: string }) => {
      await guardarTokenRefresco(sesion.tokenRefresco)
      setEstado({ fase: "dentro", usuario: sesion.usuario, tokenAcceso: sesion.tokenAcceso })
    },
    [],
  )

  useEffect(() => {
    let vigente = true

    const restaurar = async (): Promise<void> => {
      const guardado = await leerTokenRefresco()

      if (guardado === null) {
        if (vigente) setEstado({ fase: "fuera" })
        return
      }

      try {
        const sesion = await refrescarSesion(guardado)
        if (vigente) await aplicar(sesion)
      } catch {
        // El token guardado ya no sirve: caducado, revocado, o la cuenta se
        // desactivo. Se borra para no reintentarlo en cada arranque.
        await borrarTokenRefresco()
        if (vigente) setEstado({ fase: "fuera" })
      }
    }

    void restaurar()

    return () => {
      vigente = false
    }
  }, [aplicar])

  const entrar = useCallback(
    async (credenciales: Credenciales): Promise<void> => {
      await aplicar(await pedirSesion(credenciales))
    },
    [aplicar],
  )

  const salir = useCallback(async (): Promise<void> => {
    const guardado = await leerTokenRefresco()

    if (guardado !== null) {
      try {
        // Revocar en el servidor. Borrarlo solo del movil dejaria la sesion viva.
        await cerrarSesionEnServidor(guardado)
      } catch (error) {
        // Si el servidor ya lo habia invalidado, no hay nada que revocar y salir
        // localmente es lo correcto. Cualquier otro fallo si se propaga.
        if (!(error instanceof ErrorDeSesion)) throw error
      }
    }

    await borrarTokenRefresco()
    setEstado({ fase: "fuera" })
  }, [])

  const valor = useMemo<Contexto>(() => ({ estado, entrar, salir }), [estado, entrar, salir])

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>
}

export function useSesion(): Contexto {
  const contexto = useContext(ContextoSesion)

  if (contexto === null) {
    throw new Error("useSesion se ha usado fuera de ProveedorDeSesion")
  }

  return contexto
}
