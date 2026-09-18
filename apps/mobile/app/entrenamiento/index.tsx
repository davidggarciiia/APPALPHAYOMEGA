import { useRouter } from "expo-router"
import { Text } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../../src/componentes/formulario"
import { SemanaEntrenamiento } from "../../src/entrenamiento/semana"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function MiEntrenamiento(): React.JSX.Element {
  const { estado, salir, reintentar } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  return (
    <PantallaDeFormulario>
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <SemanaEntrenamiento
          clienteId={estado.usuario.id}
          api={api}
          copiaLocal
          abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
        />
      ) : (
        <Text style={{ color: tema.texto }}>Esta pantalla requiere una cuenta de cliente.</Text>
      )}
      {estado.fase === "local" ? (
        <>
          <Text style={{ color: tema.textoTenue }}>
            Sin conexión · puedes abrir las sesiones descargadas.
          </Text>
          <BotonSecundario texto="Reconectar" onPress={reintentar} />
          <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
        </>
      ) : (
        <BotonSecundario texto="Volver al inicio" onPress={() => router.replace("/")} />
      )}
    </PantallaDeFormulario>
  )
}
