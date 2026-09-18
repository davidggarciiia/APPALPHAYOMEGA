import { useRouter } from "expo-router"
import { BotonPrincipal, PantallaDeFormulario } from "../../src/componentes/formulario"
import { ListadoDeRutinas } from "../../src/entrenamiento-entrenador/listado-rutinas"
import { useRutinas } from "../../src/entrenamiento-entrenador/api-rutinas"

export default function Rutinas(): React.JSX.Element {
  const api = useRutinas(),
    router = useRouter()
  return (
    <PantallaDeFormulario sinTarjeta>
      <BotonPrincipal
        texto="Crear rutina"
        onPress={() => router.push({ pathname: "/rutinas/[id]", params: { id: "nueva" } })}
      />
      <ListadoDeRutinas
        api={api}
        elegir={(r) => router.push({ pathname: "/rutinas/[id]", params: { id: r.id } })}
      />
    </PantallaDeFormulario>
  )
}
