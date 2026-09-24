import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import {
  BotonPrincipal,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../../../src/componentes/formulario"
import { SemanaEntrenamiento } from "../../../../src/entrenamiento/semana"
import { useEntrenamiento } from "../../../../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"

export default function EntrenosCliente(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  return (
    <PantallaDeFormulario>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" && typeof id === "string" ? (
        <>
          <SemanaEntrenamiento
            clienteId={id}
            api={api}
            abrir={(sesionId) =>
              router.push({ pathname: "/entrenamiento/[id]", params: { id: sesionId } })
            }
          />
          <BotonPrincipal
            texto="Preparar plan"
            onPress={() =>
              router.push({ pathname: "/entrenador/cliente/[id]/plan", params: { id } })
            }
          />
        </>
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla requiere una cuenta de entrenador.
        </Text>
      )}
      <BotonSecundario
        texto="Volver a la ficha"
        onPress={() => router.dismissTo({ pathname: "/cliente/[id]", params: { id } })}
      />
    </PantallaDeFormulario>
  )
}
