import { useContext, useEffect, useRef, useState } from "react"
import { Platform } from "react-native"
import { NavigationContext, usePreventRemove } from "expo-router/react-navigation"
import { Dialogo } from "../entrenamiento/sesion/controles"

function GuardaDeRuta({
  activa,
  preguntar,
}: {
  activa: boolean
  preguntar: (salir: () => void) => void
}): null {
  const navigation = useContext(NavigationContext)!
  usePreventRemove(activa, ({ data }) => preguntar(() => navigation.dispatch(data.action)))
  return null
}

/** La misma confirmación protege botones internos, Atrás y los destinos del armazón. */
export function useSalidaProtegida(sinGuardar: boolean): {
  proteger: (salir: () => void) => void
  permitir: (salir: () => void) => void
  proteccion: React.JSX.Element
} {
  const navigation = useContext(NavigationContext)
  const [preguntando, setPreguntando] = useState(false)
  const [autorizada, setAutorizada] = useState(false)
  const salida = useRef<(() => void) | null>(null)
  const proteger = (accion: () => void): void => {
    if (!sinGuardar) return accion()
    salida.current = accion
    setAutorizada(false)
    setPreguntando(true)
  }
  const permitir = (accion: () => void): void => {
    salida.current = accion
    setAutorizada(true)
  }
  useEffect(() => {
    if (!autorizada) return
    const accion = salida.current
    salida.current = null
    accion?.()
    setAutorizada(false)
  }, [autorizada])
  useEffect(() => {
    if (Platform.OS !== "web" || !sinGuardar) return
    const impedir = (evento: BeforeUnloadEvent): void => {
      evento.preventDefault()
      evento.returnValue = ""
    }
    globalThis.addEventListener("beforeunload", impedir)
    return () => globalThis.removeEventListener("beforeunload", impedir)
  }, [sinGuardar])
  return {
    proteger,
    permitir,
    proteccion: (
      <>
        {navigation && <GuardaDeRuta activa={sinGuardar && !autorizada} preguntar={proteger} />}
        <Dialogo
          visible={preguntando}
          titulo="¿Salir sin guardar?"
          texto="Tienes cambios sin guardar. Si sales ahora se perderán."
          confirmar="Salir sin guardar"
          cancelar="Seguir editando"
          alConfirmar={() => {
            setPreguntando(false)
            setAutorizada(true)
          }}
          alCancelar={() => {
            salida.current = null
            setPreguntando(false)
          }}
        />
      </>
    ),
  }
}
