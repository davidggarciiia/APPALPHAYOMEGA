import { randomUUID } from "expo-crypto"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useNutricion } from "../../../../src/nutricion/api"
import { PanelDieta } from "../../../../src/nutricion/panel-dieta"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"

/** La dieta de un cliente, para el entrenador o su nutricionista. */
export default function DietaDelCliente(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado } = useSesion()
  const api = useNutricion()
  const router = useRouter()
  const profesional =
    estado.fase === "dentro" &&
    (estado.usuario.rol === "entrenador" || estado.usuario.rol === "nutricionista")
  return (
    <PantallaDeFormulario sinTarjeta>
      {profesional && typeof id === "string" ? (
        <PanelDieta
          clienteId={id}
          api={api}
          nuevoId={randomUUID}
          editar={(origen) =>
            router.push({ pathname: "/nutricion/cliente/[id]/editar", params: { id, origen } })
          }
        />
      ) : (
        <Text style={{ color: tema.texto }}>
          Esta pantalla es para el entrenador o el nutricionista.
        </Text>
      )}
      <BotonSecundario texto="Volver" onPress={() => router.back()} />
    </PantallaDeFormulario>
  )
}
