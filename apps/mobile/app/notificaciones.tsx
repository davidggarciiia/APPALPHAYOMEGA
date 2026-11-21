import { RefreshControl, ScrollView, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { BandejaNotificaciones } from "../src/notificaciones/bandeja"
import { useNotificaciones } from "../src/notificaciones/contexto"
import { tema } from "../src/tema"

export default function Notificaciones(): React.JSX.Element {
  const buzon = useNotificaciones()
  return (
    <SafeAreaView edges={["left", "right"]} style={s.pantalla}>
      <ScrollView
        testID="lista-notificaciones"
        contentContainerStyle={s.contenido}
        // Tirar hacia abajo vuelve a pedir los avisos, sin esperar al aviso automático.
        refreshControl={
          buzon ? (
            <RefreshControl
              refreshing={buzon.cargando && buzon.clientes !== null}
              onRefresh={buzon.recargar}
              tintColor={tema.acento}
              colors={[tema.acento]}
              progressBackgroundColor={tema.superficie}
            />
          ) : undefined
        }
      >
        <BandejaNotificaciones />
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "transparent" },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
})
