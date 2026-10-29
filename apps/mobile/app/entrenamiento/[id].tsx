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
  const volver = (): void => (router.canGoBack() ? router.back() : router.replace("/entrenamiento"))
  if ("usuario" in estado && estado.usuario.rol === "cliente")
    return (
      <RegistroCliente
        cuenta={estado.usuario.id}
        id={id}
        api={api}
        salir={volver}
        listo={() => router.replace("/")}
      />
    )
  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" ? (
        <>
          <BotonSecundario texto="← Volver" onPress={volver} />
          <DetalleEntrenador id={id} api={api} />
        </>
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Inicia sesión para abrir el entrenamiento.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
