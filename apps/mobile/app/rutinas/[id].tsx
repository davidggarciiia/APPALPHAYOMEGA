import { useLocalSearchParams, useRouter } from "expo-router"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { EditorRutina } from "../../src/entrenamiento-entrenador/editor-rutina"
import { useRutinas } from "../../src/entrenamiento-entrenador/api-rutinas"
import { useCatalogo } from "../../src/catalogo-ejercicios/use-catalogo"

export default function Rutina(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const api = useRutinas(),
    catalogo = useCatalogo(),
    router = useRouter()
  return (
    <PantallaDeFormulario>
      <EditorRutina
        key={id}
        id={id}
        api={api}
        catalogo={catalogo}
        terminado={() => router.dismissTo("/rutinas")}
      />
      <BotonSecundario texto="Volver a rutinas" onPress={() => router.dismissTo("/rutinas")} />
    </PantallaDeFormulario>
  )
}
