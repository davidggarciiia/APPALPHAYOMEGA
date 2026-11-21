import { Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { PantallaDeFormulario } from "../src/componentes/formulario"
import { ProgresoRedisenado } from "../src/seguimiento/progreso-redisenado"
import { useSeguimiento } from "../src/seguimiento/use-seguimiento"
import { useMedios } from "../src/seguimiento/use-medios"
import { useValoraciones } from "../src/seguimiento/use-valoraciones"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

export default function Progreso(): React.JSX.Element {
  const { estado } = useSesion()
  const seguimiento = useSeguimiento()
  const valoraciones = useValoraciones()
  const medios = useMedios()
  if ("usuario" in estado && estado.usuario.rol === "cliente")
    return (
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
        <ProgresoRedisenado
          clienteId={estado.usuario.id}
          seguimiento={seguimiento}
          valoraciones={valoraciones}
          medios={medios}
        />
      </SafeAreaView>
    )
  return (
    <PantallaDeFormulario sinTarjeta>
      <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
        Esta pantalla es para clientes.
      </Text>
    </PantallaDeFormulario>
  )
}
