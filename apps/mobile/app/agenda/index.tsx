import { Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { AgendaEntrenador } from "../../src/reservas/agenda-entrenador"
import { useReservas } from "../../src/reservas/api"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

/** Pestaña «Agenda» del entrenador: semana, horario, solicitudes y cobros. */
export default function Agenda(): React.JSX.Element {
  const { estado } = useSesion()
  const api = useReservas()
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: "transparent" }}>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" ? (
        <AgendaEntrenador api={api} />
      ) : (
        <View style={{ padding: 20 }}>
          <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
            Esta pantalla es para el entrenador.
          </Text>
        </View>
      )}
    </SafeAreaView>
  )
}
