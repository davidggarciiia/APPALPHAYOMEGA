import { useEffect, useState } from "react"
import { randomUUID } from "expo-crypto"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { FichaDeUsuarioSchema } from "@alpha-omega/shared"

import { PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useCatalogo } from "../../../../src/catalogo-ejercicios/use-catalogo"
import { useEntrenamiento } from "../../../../src/entrenamiento/use-entrenamiento"
import { ConstructorPlan } from "../../../../src/entrenamiento-entrenador/constructor/constructor"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"
import { almacenDispositivo } from "../../../../src/entrenamiento/almacen-dispositivo"
import { useRutinas } from "../../../../src/entrenamiento-entrenador/api-rutinas"

/** «Crear plan nuevo»: prepara una nueva asignación para el cliente. */
export default function PrepararPlan(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado, pedir } = useSesion()
  const api = useEntrenamiento()
  const catalogo = useCatalogo()
  const rutinas = useRutinas()
  const router = useRouter()
  const [nombre, setNombre] = useState("el cliente")
  useEffect(() => {
    if (typeof id !== "string") return
    let vigente = true
    pedir(`/usuarios/${encodeURIComponent(id)}`, FichaDeUsuarioSchema)
      .then((ficha) => {
        if (vigente) setNombre([ficha.nombre, ficha.apellidos].filter(Boolean).join(" "))
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [pedir, id])
  const aLaFicha = (): void =>
    router.canGoBack()
      ? router.back()
      : router.replace({ pathname: "/entrenador/cliente/[id]", params: { id } })
  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" && typeof id === "string" ? (
        <ConstructorPlan
          key={id}
          clienteId={id}
          cuentaId={estado.usuario.id}
          nombreCliente={nombre}
          almacen={almacenDispositivo}
          api={api}
          catalogo={catalogo}
          rutinas={rutinas}
          nuevoId={randomUUID}
          terminado={aLaFicha}
          volver={aLaFicha}
        />
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla requiere una cuenta de entrenador.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
