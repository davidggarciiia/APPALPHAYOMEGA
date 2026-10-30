import { Text } from "react-native"
import { PantallaDeFormulario } from "../src/componentes/formulario"
import { MiProgreso } from "../src/seguimiento/mi-progreso"
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
  return (
    <PantallaDeFormulario sinTarjeta>
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <MiProgreso
          clienteId={estado.usuario.id}
          seguimiento={seguimiento}
          valoraciones={valoraciones}
          medios={medios}
        />
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla es para clientes.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
