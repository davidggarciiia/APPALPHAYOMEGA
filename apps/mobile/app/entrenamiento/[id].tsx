import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { PantallaDeFormulario } from "../../src/componentes/formulario"
import { useEntrenamiento } from "../../src/entrenamiento/use-entrenamiento"
import { RegistroCliente } from "../../src/entrenamiento/registro-cliente"
import { DetalleEntrenador } from "../../src/entrenamiento-entrenador/detalle"
import { useSesion } from "../../src/sesion"
import { tema } from "../../src/tema"

export default function DetalleEntrenamiento(): React.JSX.Element {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>()
  const { estado } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  const esEntrenador = estado.fase === "dentro" && estado.usuario.rol === "entrenador"
  const volver = (): void =>
    router.canGoBack()
      ? router.back()
      : router.replace(esEntrenador ? "/cartera" : "/entrenamiento")
  if ("usuario" in estado && estado.usuario.rol === "cliente")
    return (
      <RegistroCliente
        cuenta={estado.usuario.id}
        id={id}
        api={api}
        salir={volver}
        listo={() => router.replace("/")}
      />
    )
  if (esEntrenador)
    return (
      <DetalleEntrenador
        id={id}
        api={api}
        nombreCliente={typeof nombre === "string" ? nombre : undefined}
        salir={volver}
      />
    )
  return (
    <PantallaDeFormulario sinTarjeta>
      <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
        Inicia sesión para abrir el entrenamiento.
      </Text>
    </PantallaDeFormulario>
  )
}
