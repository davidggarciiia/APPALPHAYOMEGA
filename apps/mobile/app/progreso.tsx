import { useCallback } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { PantallaDeFormulario } from "../src/componentes/formulario"
import { ProgresoRedisenado } from "../src/seguimiento/progreso-redisenado"
import { useSeguimiento } from "../src/seguimiento/use-seguimiento"
import { useMedios } from "../src/seguimiento/use-medios"
import { useValoraciones } from "../src/seguimiento/use-valoraciones"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * `/progreso?abrir=fotos` abre las solicitudes de fotos y `?abrir=valoraciones`, las
 * valoraciones (enlaces de las notificaciones). Cualquier otro valor se ignora.
 */
export default function Progreso(): React.JSX.Element {
  const { estado } = useSesion()
  const seguimiento = useSeguimiento()
  const valoraciones = useValoraciones()
  const medios = useMedios()
  const router = useRouter()
  const { abrir } = useLocalSearchParams<{ abrir?: string | string[] }>()
  const destino = Array.isArray(abrir) ? abrir[0] : abrir
  const abrirAhora = destino === "fotos" || destino === "valoraciones" ? destino : undefined
  // Olvidar el parámetro una vez usado: el mismo enlace, otra vez, volverá a abrir.
  const alAbrir = useCallback(() => router.setParams({ abrir: undefined }), [router])
  if ("usuario" in estado && estado.usuario.rol === "cliente")
    return (
      <SafeAreaView edges={["left", "right"]} style={{ flex: 1 }}>
        <ProgresoRedisenado
          clienteId={estado.usuario.id}
          seguimiento={seguimiento}
          valoraciones={valoraciones}
          medios={medios}
          abrir={abrirAhora}
          alAbrir={alAbrir}
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
