import { useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { PlanCliente } from "../../src/entrenamiento/plan/plan-cliente"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function MiEntrenamiento(): React.JSX.Element {
  const { estado, salir, reintentar } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  return (
    <PantallaDeFormulario sinTarjeta>
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <PlanCliente
          clienteId={estado.usuario.id}
          api={api}
          abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
        />
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla requiere una cuenta de cliente.
        </Text>
      )}
      {estado.fase === "local" ? (
        <>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.textoTenue }}>
            Sin conexión · puedes abrir las sesiones descargadas.
          </Text>
          <BotonSecundario texto="Reconectar" onPress={reintentar} />
          <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
        </>
      ) : null}
    </PantallaDeFormulario>
  )
}
