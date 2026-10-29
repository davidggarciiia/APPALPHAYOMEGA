import { randomUUID } from "expo-crypto"
import { useMemo } from "react"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Text } from "react-native"
import { PantallaDeFormulario } from "../../../../src/componentes/formulario"
import { useNutricion } from "../../../../src/nutricion/api"
import { FichaNutricion } from "../../../../src/nutricion/ficha-nutricion"
import { crearConsultaValoracionParaPauta } from "../../../../src/nutricion/valoracion-para-pauta"
import { useSeguimiento } from "../../../../src/seguimiento/use-seguimiento"
import { useSesion } from "../../../../src/sesion"
import { tema } from "../../../../src/tema"

/** La ficha de nutrición de un cliente, para el entrenador o su nutricionista. */
export default function DietaDelCliente(): React.JSX.Element {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>()
  const { estado, pedir } = useSesion()
  const consultarValoracion = useMemo(() => crearConsultaValoracionParaPauta(pedir), [pedir])
  const api = useNutricion()
  const seguimiento = useSeguimiento()
  const router = useRouter()
  const profesional =
    estado.fase === "dentro" &&
    (estado.usuario.rol === "entrenador" || estado.usuario.rol === "nutricionista")
  return (
    <PantallaDeFormulario sinTarjeta>
      {profesional && typeof id === "string" ? (
        <FichaNutricion
          clienteId={id}
          nombre={typeof nombre === "string" && nombre !== "" ? nombre : "Cliente"}
          api={api}
          seguimiento={seguimiento}
          consultarValoracion={consultarValoracion}
          nuevoId={randomUUID}
          editar={(origen) =>
            router.push({ pathname: "/nutricion/cliente/[id]/editar", params: { id, origen } })
          }
        />
      ) : (
        <Text style={{ fontFamily: tema.fuenteTexto, color: tema.texto }}>
          Esta pantalla es para el entrenador o el nutricionista.
        </Text>
      )}
    </PantallaDeFormulario>
  )
}
