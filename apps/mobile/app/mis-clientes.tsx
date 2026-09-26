import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { BotonSecundario } from "../src/componentes/formulario"
import { InsigniaDeEstado } from "../src/componentes/insignia-estado"
import { HOLGURA_DE_ENLACE, Pulsable } from "../src/componentes/pulsable"
import { listarMisClientes } from "../src/lib/api"
import { faltaDe, type Falta } from "../src/lib/errores"
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
  const { estado: sesion } = useSesion()
  const router = useRouter()

  const [fase, setFase] = useState<Fase>("cargando")
  const [clientes, setClientes] = useState<ResumenUsuario[]>([])
  const [falta, setFalta] = useState<Falta>(SIN_FALTA)
  const [intento, setIntento] = useState(0)

  const tokenAcceso = sesion.fase === "dentro" ? sesion.tokenAcceso : null

  useEffect(() => {
    if (tokenAcceso === null) return

    let vigente = true

    listarMisClientes(tokenAcceso)
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
  }, [tokenAcceso, intento])

  if (fase === "cargando") {
    return (
      <View style={estilos.centrado}>
        <ActivityIndicator
          color={tema.oro}
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
        <BotonSecundario
          texto="VOLVER"
          onPress={() => {
            router.back()
          }}
        />
      </View>
    )
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>MIS CLIENTES</Text>
        <Pulsable
          onPress={() => {
            router.back()
          }}
          accessibilityRole="button"
          hitSlop={HOLGURA_DE_ENLACE}
        >
          <Text style={estilos.volver}>VOLVER</Text>
        </Pulsable>
      </View>

      <FlatList
        data={clientes}
        keyExtractor={(cliente) => cliente.id}
        contentContainerStyle={estilos.lista}
        renderItem={({ item }) => {
          const nombre = [item.nombre, item.apellidos].filter(Boolean).join(" ")

          return (
            <View style={estilos.fila} accessible accessibilityLabel={`${nombre}. ${item.email}`}>
              <View style={estilos.datos}>
                <Text style={estilos.nombre} numberOfLines={1}>
                  {nombre}
                </Text>
                <Text style={estilos.correo} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <InsigniaDeEstado estado={item.estado} />
            </View>
          )
        }}
        ListEmptyComponent={
          <Text style={estilos.vacio}>
            El entrenador todavía no te ha asignado ningún cliente. Cuando lo haga aparecerán aquí.
          </Text>
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
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titulo: { color: tema.oro, fontSize: 16, fontWeight: "700", letterSpacing: 3 },
  volver: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
  aviso: { color: tema.texto, fontSize: 15, textAlign: "center" },
  lista: { padding: 20, gap: 10 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  datos: { flex: 1, gap: 3 },
  nombre: { color: tema.texto, fontSize: 16 },
  correo: { color: tema.textoTenue, fontSize: 12 },
  vacio: {
    color: tema.textoTenue,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 40,
  },
})
