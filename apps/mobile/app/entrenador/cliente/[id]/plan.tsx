import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useCatalogo } from "../../../../src/catalogo-ejercicios/use-catalogo"
import { useEntrenamiento } from "../../../../src/entrenamiento/use-entrenamiento"
import { EditorPlan } from "../../../../src/entrenamiento-entrenador/editor-plan"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"
import { almacenDispositivo } from "../../../../src/entrenamiento/almacen-dispositivo"
import { useRutinas } from "../../../../src/entrenamiento-entrenador/api-rutinas"

export default function PrepararPlan(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const catalogo = useCatalogo()
  const rutinas = useRutinas()
  const router = useRouter()
  return (
    <PantallaDeFormulario>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" && typeof id === "string" ? (
        <EditorPlan
          key={id}
          clienteId={id}
          cuentaId={estado.usuario.id}
          almacen={almacenDispositivo}
          api={api}
          catalogo={catalogo}
          rutinas={rutinas}
          terminado={() =>
            router.dismissTo({ pathname: "/entrenador/cliente/[id]/entrenos", params: { id } })
          }
        />
      ) : (
        <Text style={{ color: tema.texto }}>Esta pantalla requiere una cuenta de entrenador.</Text>
      )}
      <BotonSecundario texto="Volver" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}
