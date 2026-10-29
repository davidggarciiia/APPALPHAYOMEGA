import { useCallback } from "react"
import { randomUUID } from "expo-crypto"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { FichaDeUsuarioSchema } from "@alpha-omega/shared"

import { PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useEntrenamiento } from "../../../../src/entrenamiento/use-entrenamiento"
import { FichaCliente } from "../../../../src/entrenamiento-entrenador/ficha/ficha-cliente"
import { useNutricion } from "../../../../src/nutricion/api"
import { useSeguimiento } from "../../../../src/seguimiento/use-seguimiento"
import { useMedios } from "../../../../src/seguimiento/use-medios"
import { useValoraciones } from "../../../../src/seguimiento/use-valoraciones"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"

/** La ficha del cliente del diseño, para el entrenador. */
export default function FichaDelCliente(): React.JSX.Element {
  const { id, valoracionInicial } = useLocalSearchParams<{
    id: string
    valoracionInicial?: string
  }>()
  const { estado, pedir } = useSesion()
  const api = useEntrenamiento()
  const seguimiento = useSeguimiento()
  const valoraciones = useValoraciones()
  const medios = useMedios()
  const nutricion = useNutricion()
  const router = useRouter()
  const leerFicha = useCallback(
    () => pedir(`/usuarios/${encodeURIComponent(id)}`, FichaDeUsuarioSchema),
    [pedir, id],
  )
  return (
    <PantallaDeFormulario sinTarjeta>
      {estado.fase === "dentro" && estado.usuario.rol === "entrenador" && typeof id === "string" ? (
        <FichaCliente
          clienteId={id}
          cuentaId={estado.usuario.id}
          leerFicha={leerFicha}
          api={api}
          seguimiento={seguimiento}
          valoraciones={valoraciones}
          medios={medios}
          nutricion={nutricion}
          nuevoId={randomUUID}
          valoracionInicial={valoracionInicial === "1"}
          editarPlan={() =>
            router.push({ pathname: "/entrenador/cliente/[id]/plan", params: { id } })
          }
          verSemana={(nombre) =>
            router.push({ pathname: "/entrenador/cliente/[id]/entrenos", params: { id, nombre } })
          }
          abrirNutricion={(nombre) =>
            router.push({ pathname: "/nutricion/cliente/[id]", params: { id, nombre } })
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
