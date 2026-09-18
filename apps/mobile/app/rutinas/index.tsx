import { useRouter } from "expo-router"
import { Text } from "react-native"
import {
  BotonPrincipal,
  BotonSecundario,
  PantallaDeFormulario,
} from "../../src/componentes/formulario"
import { ListadoDeRutinas } from "../../src/entrenamiento-entrenador/listado-rutinas"
import { useRutinas } from "../../src/entrenamiento-entrenador/api-rutinas"
import { tema } from "../../src/tema"

export default function Rutinas(): React.JSX.Element {
  const api = useRutinas(),
    router = useRouter()
  return (
    <PantallaDeFormulario>
      <Text style={{ color: tema.texto, fontSize: 28, fontWeight: "800" }}>Mis rutinas</Text>
      <BotonPrincipal
        texto="Crear rutina"
        onPress={() => router.push({ pathname: "/rutinas/[id]", params: { id: "nueva" } })}
      />
      <ListadoDeRutinas
        api={api}
        elegir={(r) => router.push({ pathname: "/rutinas/[id]", params: { id: r.id } })}
      />
      <BotonSecundario texto="Volver al inicio" onPress={() => router.replace("/")} />
    </PantallaDeFormulario>
  )
}
