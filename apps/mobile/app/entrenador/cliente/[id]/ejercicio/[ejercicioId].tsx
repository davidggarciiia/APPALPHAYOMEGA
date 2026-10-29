import { useCallback } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { FichaDeUsuarioSchema } from "@alpha-omega/shared"
import { PantallaDeFormulario } from "../../../../../src/componentes/formulario"
import { useEntrenamiento } from "../../../../../src/entrenamiento/use-entrenamiento"
import { ProgresionEjercicio } from "../../../../../src/entrenamiento-entrenador/ficha/progresion-ejercicio"
import { useSeguimiento } from "../../../../../src/seguimiento/use-seguimiento"
import { useSesion } from "../../../../../src/sesion"
import { tema } from "../../../../../src/tema"

export default function ProgresionDelEjercicio(): React.JSX.Element {
  const { id, ejercicioId } = useLocalSearchParams<{ id: string; ejercicioId: string }>()
  const { estado, pedir } = useSesion()
  const api = useEntrenamiento()
  const seguimiento = useSeguimiento()
  const router = useRouter()
  const leerFicha = useCallback(
    () => pedir(`/usuarios/${encodeURIComponent(id)}`, FichaDeUsuarioSchema),
    [pedir, id],
  )
  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "dentro" &&
      estado.usuario.rol === "entrenador" &&
      typeof id === "string" &&
      typeof ejercicioId === "string" ? (
        <ProgresionEjercicio
          key={`${estado.usuario.id}:${id}:${ejercicioId}`}
          clienteId={id}
          ejercicioId={ejercicioId}
          api={api}
          seguimiento={seguimiento}
          leerFicha={leerFicha}
          volver={() =>
            router.canGoBack()
              ? router.back()
              : router.replace({
                  pathname: "/entrenador/cliente/[id]",
                  params: { id, pestana: "progreso" },
                })
          }
          ajustar={(ejercicioId) =>
            router.push({ pathname: "/entrenador/cliente/[id]/plan", params: { id, ejercicioId } })
          }
          abrirSesion={(id, nombre) =>
            router.push({ pathname: "/entrenamiento/[id]", params: { id, nombre } })
          }
        />
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla requiere una cuenta de entrenador.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
