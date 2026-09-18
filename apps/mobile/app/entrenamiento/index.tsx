import { useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { SemanaEntrenamiento } from "../../src/entrenamiento/semana"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function MiEntrenamiento(): React.JSX.Element {
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  return (
    <PantallaDeFormulario>
      {estado.fase === "dentro" && estado.usuario.rol === "cliente" ? (
        <SemanaEntrenamiento
          clienteId={estado.usuario.id}
          api={api}
          abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
        />
      ) : (
        <Text style={{ color: tema.texto }}>Esta pantalla requiere una cuenta de cliente.</Text>
      )}
      <BotonSecundario texto="Volver al inicio" onPress={() => router.replace("/")} />
    </PantallaDeFormulario>
  )
}
