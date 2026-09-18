import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { RegistroCliente } from "../../src/entrenamiento/registro-cliente"
import { DetalleEntrenador } from "../../src/entrenamiento-entrenador/detalle"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function DetalleEntrenamiento(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  return (
    <PantallaDeFormulario sinTarjeta>
      <BotonSecundario
        texto="← Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/entrenamiento"))}
      />
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <RegistroCliente cuenta={estado.usuario.id} id={id} api={api} />
      ) : estado.fase === "dentro" && estado.usuario.rol === "entrenador" ? (
        <DetalleEntrenador id={id} api={api} />
      ) : (
        <Text style={{ color: tema.texto }}>Inicia sesión para abrir el entrenamiento.</Text>
      )}
    </PantallaDeFormulario>
  )
}
