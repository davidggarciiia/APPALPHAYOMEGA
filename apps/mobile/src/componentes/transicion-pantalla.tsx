import { useCallback, useState, type ReactNode } from "react"
import { StyleSheet } from "react-native"
import { useFocusEffect } from "expo-router"

import { DURACION } from "./movimiento"
import { Revelado } from "./revelado"

export function TransicionPantalla({ children }: { children: ReactNode }): React.JSX.Element {
  const [enfoque, fijar] = useState({ clave: 0, activo: false })
  useFocusEffect(
    useCallback(() => {
      fijar((previo) => ({ clave: previo.clave + 1, activo: true }))
      return () => fijar((previo) => ({ ...previo, activo: false }))
    }, []),
  )
  return (
    <Revelado
      estilo={estilos.raiz}
      clave={enfoque.clave}
      activo={enfoque.activo}
      retraso={0}
      duracion={DURACION.normal}
    >
      {children}
    </Revelado>
  )
}

export function envolverPantalla({ children }: { children: ReactNode }): React.JSX.Element {
  return <TransicionPantalla>{children}</TransicionPantalla>
}

const estilos = StyleSheet.create({ raiz: { flex: 1 } })
