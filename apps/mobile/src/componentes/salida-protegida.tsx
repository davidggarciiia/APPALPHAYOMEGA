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
  usePreventRemove(activa, ({ data }) => preguntar(() => navigation.dispatchSync(data.action)))
  return null
}

type Textos = { titulo: string; texto: string; confirmar: string; cancelar: string }

const TEXTOS_POR_DEFECTO: Textos = {
  titulo: "¿Salir sin guardar?",
  texto: "Tienes cambios sin guardar. Si sales ahora se perderán.",
  confirmar: "Salir sin guardar",
  cancelar: "Seguir editando",
}

/** La misma confirmación protege botones internos, Atrás y los destinos del armazón. */
export function useSalidaProtegida(
  sinGuardar: boolean,
  textos: Textos = TEXTOS_POR_DEFECTO,
): {
  proteger: (salir: () => void) => void
  permitir: (salir: () => void) => void
  proteccion: React.JSX.Element
} {
  const navigation = useContext(NavigationContext)
  const [preguntando, setPreguntando] = useState(false)
  const [autorizacion, setAutorizacion] = useState<"ejecutar" | "rearmar" | null>(null)
  const salida = useRef<(() => void) | null>(null)
  const proteger = (accion: () => void): void => {
    if (!sinGuardar) return accion()
    salida.current = accion
    setAutorizacion(null)
    setPreguntando(true)
  }
  const permitir = (accion: () => void): void => {
    salida.current = accion
    setAutorizacion("ejecutar")
  }
  useEffect(() => {
    if (autorizacion === "ejecutar") {
      const accion = salida.current
      salida.current = null
      accion?.()
      // La cola del SDK 58 necesita un commit con la guarda desactivada antes del rearme.
      setAutorizacion("rearmar")
    } else if (autorizacion === "rearmar") setAutorizacion(null)
  }, [autorizacion])
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
        {navigation && (
          <GuardaDeRuta activa={sinGuardar && autorizacion === null} preguntar={proteger} />
        )}
        <Dialogo
          visible={preguntando}
          titulo={textos.titulo}
          texto={textos.texto}
          confirmar={textos.confirmar}
          cancelar={textos.cancelar}
          alConfirmar={() => {
            setPreguntando(false)
            setAutorizacion("ejecutar")
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
