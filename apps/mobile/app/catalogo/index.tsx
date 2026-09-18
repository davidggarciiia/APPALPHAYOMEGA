import { Redirect, useFocusEffect, useRouter } from "expo-router"
import { useCallback, useState } from "react"
import { Catalogo } from "../../src/catalogo-ejercicios/catalogo"
import { useCatalogo } from "../../src/catalogo-ejercicios/use-catalogo"
import { useSesion } from "../../src/sesion"

export default function RutaCatalogo(): React.JSX.Element {
  const api = useCatalogo()
  const { estado } = useSesion()
  const router = useRouter()
  const [visita, setVisita] = useState(0)
  useFocusEffect(
    useCallback(() => {
      setVisita((valor) => valor + 1)
    }, []),
  )
  if (estado.fase !== "dentro" || estado.usuario.rol !== "entrenador") return <Redirect href="/" />
  return (
    <Catalogo
      key={visita}
      api={api}
      onNuevo={() => router.push("/catalogo/nuevo")}
      onVolver={() => router.replace("/")}
      onAbrir={(id) => router.push({ pathname: "/catalogo/[id]", params: { id } })}
    />
  )
}
