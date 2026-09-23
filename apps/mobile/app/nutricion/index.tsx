import { Text } from "react-native"
import { PantallaDeFormulario } from "../../src/componentes/formulario"
import { almacenDispositivo } from "../../src/entrenamiento/almacen-dispositivo"
import { useNutricion } from "../../src/nutricion/api"
import { VistaDieta } from "../../src/nutricion/vista-dieta"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

/** La dieta del cliente. También sin conexión, con la última copia descargada. */
export default function MiDieta(): React.JSX.Element {
  const { estado } = useSesion()
  const api = useNutricion()
  return (
    <PantallaDeFormulario sinTarjeta>
      {"usuario" in estado && estado.usuario.rol === "cliente" ? (
        <VistaDieta
          clienteId={estado.usuario.id}
          cuenta={estado.usuario.id}
          api={api}
          almacen={almacenDispositivo}
        />
      ) : (
        <Text style={{ color: tema.texto }}>
          Esta pantalla es la dieta de una cuenta de cliente.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
