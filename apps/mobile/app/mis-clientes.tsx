import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { BotonSecundario } from "../src/componentes/formulario"
import { listarMisClientes } from "../src/lib/api"
import { faltaDe, type Falta } from "../src/lib/errores"
import { ListaClientes, nombreCompleto } from "../src/nutricion/lista-clientes"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

type Fase = "cargando" | "listo" | "error"

const SIN_FALTA: Falta = { texto: "", reintentable: true, sesionCaducada: false }

/**
 * Lo que ve el nutricionista: sus asignados y nadie mas.
 *
 * La lista no lleva identificador en la peticion. Sale del token que el servidor
 * ya verifico, asi que no hay forma de pedir la lista de otro cambiando un
 * numero.
 */
export default function MisClientes(): React.JSX.Element {
  const { estado: sesion, pedir } = useSesion()
  const router = useRouter()

  const [fase, setFase] = useState<Fase>("cargando")
  const [clientes, setClientes] = useState<ResumenUsuario[]>([])
  const [falta, setFalta] = useState<Falta>(SIN_FALTA)
  const [intento, setIntento] = useState(0)

  const tokenAcceso = sesion.fase === "dentro" ? sesion.tokenAcceso : null

  useEffect(() => {
    if (tokenAcceso === null) return

    let vigente = true

    listarMisClientes(pedir)
      .then((listado) => {
        if (!vigente) return

        setClientes(listado.usuarios)
        setFase("listo")
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setFalta(faltaDe(error, "No hemos podido cargar tus clientes."))
        setFase("error")
      })

    return () => {
      vigente = false
    }
  }, [tokenAcceso, pedir, intento])

  if (fase === "cargando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator
          color={tema.acento}
          size="large"
          accessibilityLabel="Cargando tus clientes"
        />
      </View>
    )
  }

  if (fase === "error") {
    return (
      <View style={estilos.centrado}>
        <Text style={estilos.aviso} accessibilityRole="alert">
          {falta.texto}
        </Text>
        {falta.reintentable && (
          <BotonSecundario
            texto="REINTENTAR"
            onPress={() => {
              setFase("cargando")
              setIntento((n) => n + 1)
            }}
          />
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <ListaClientes
        clientes={clientes}
        abrir={(cliente) =>
          router.push({
            pathname: "/nutricion/cliente/[id]",
            params: { id: cliente.id, nombre: nombreCompleto(cliente) },
          })
        }
      />
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  centrado: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
    padding: 24,
  },
  aviso: { fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 15, textAlign: "center" },
})
