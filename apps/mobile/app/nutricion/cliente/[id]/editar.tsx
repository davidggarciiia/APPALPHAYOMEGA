import { randomUUID } from "expo-crypto"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useNutricion } from "../../../../src/nutricion/api"
import { EditorDieta, type OrigenDelEditor } from "../../../../src/nutricion/editor-dieta"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"

const ORIGENES: readonly OrigenDelEditor[] = ["borrador", "vigente", "nueva"]

export default function EditarDieta(): React.JSX.Element {
  const { id, origen } = useLocalSearchParams<{ id: string; origen?: string }>()
  const { estado } = useSesion()
  const api = useNutricion()
  const router = useRouter()
  const profesional =
    estado.fase === "dentro" &&
    (estado.usuario.rol === "entrenador" || estado.usuario.rol === "nutricionista")
  const desde = ORIGENES.find((valor) => valor === origen) ?? "borrador"
  return (
    <PantallaDeFormulario sinTarjeta>
      {profesional && typeof id === "string" ? (
        <EditorDieta
          key={`${id}-${desde}`}
          clienteId={id}
          api={api}
          origen={desde}
          ids={randomUUID}
          volver={() =>
            router.canGoBack()
              ? router.back()
              : router.replace({ pathname: "/nutricion/cliente/[id]", params: { id } })
          }
        />
      ) : (
        <Text style={{ color: tema.texto }}>
          Esta pantalla es para el entrenador o el nutricionista.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
