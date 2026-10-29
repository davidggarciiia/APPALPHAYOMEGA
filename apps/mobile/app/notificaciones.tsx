import { PantallaDeFormulario } from "../src/componentes/formulario"
import { BandejaNotificaciones } from "../src/notificaciones/bandeja"

export default function Notificaciones(): React.JSX.Element {
  return (
    <PantallaDeFormulario sinTarjeta>
      <BandejaNotificaciones />
    </PantallaDeFormulario>
  )
}
