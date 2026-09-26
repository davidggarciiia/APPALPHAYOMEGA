import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useReservas } from "../src/reservas/api"
import { ReservarCliente } from "../src/reservas/reservar-cliente"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/** Pestaña «Reservar» del cliente: su saldo, los huecos libres y sus reservas. */
export default function Reservar(): React.JSX.Element {
  const { estado } = useSesion()
  const api = useReservas()
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: "transparent" }}>
      {estado.fase === "dentro" && estado.usuario.rol === "cliente" ? (
        <ReservarCliente key={estado.usuario.id} api={api} />
      ) : (
        <View style={{ padding: 20 }}>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
            Esta pantalla es para clientes.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}
