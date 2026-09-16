import { useRouter } from "expo-router"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { EstadoUsuario, ResumenUsuario } from "@alpha-omega/shared"

import { ErrorDePermiso, ErrorDeRed, listarUsuarios } from "../src/lib/api"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * Cuantos clientes se piden de una vez.
 *
 * Con la cartera actual sobra de largo. Si algun dia no sobra, la pantalla lo
 * dice en voz alta en lugar de cortar la lista en silencio: ver "mostrando 100
 * de 130" es lo que evita que alguien de por perdido a un cliente que si estaba.
 */
const LIMITE = 100

/** Cuanto se espera a que el entrenador deje de teclear antes de preguntar. */
const ESPERA_DE_BUSQUEDA_MS = 300

const FILTROS: ReadonlyArray<{ etiqueta: string; estado: EstadoUsuario | null }> = [
  { etiqueta: "TODOS", estado: null },
  { etiqueta: "PENDIENTES", estado: "pendiente" },
  { etiqueta: "ACTIVOS", estado: "activo" },
  { etiqueta: "BAJAS", estado: "desactivado" },
]

/**
 * El estado no se distingue solo por color.
 *
 * Un punto de color no dice nada a quien no distingue esos dos tonos, ni a quien
 * usa un lector de pantalla. La palabra va siempre escrita.
 */
const ETIQUETA_DE_ESTADO: Record<EstadoUsuario, string> = {
  pendiente: "PENDIENTE",
  activo: "ACTIVO",
  desactivado: "BAJA",
}

type Fase = "cargando" | "listo" | "error"

type Fallo = { texto: string; reintentable: boolean }

/**
 * Que se le dice al usuario segun lo que haya fallado.
 *
 * El 403 tiene mensaje propio y **no** ofrece reintentar. Quien llega aqui sin
 * ser entrenador no ha tenido un problema tecnico: ha entrado donde no le toca,
 * y un boton de reintentar solo le haria insistir contra una puerta cerrada.
 */
function faltaDe(error: unknown): Fallo {
  if (error instanceof ErrorDeRed) {
    return { texto: "No hemos podido conectar. Revisa tu conexión.", reintentable: true }
  }

  if (error instanceof ErrorDePermiso) {
    return { texto: "Esta pantalla es solo para el entrenador.", reintentable: false }
  }

  return { texto: "No hemos podido cargar tu cartera.", reintentable: true }
}

/**
 * La cartera del entrenador.
 *
 * Solo lista clientes. El nutricionista y el empleado se administran desde sus
 * propias pantallas (tareas 17 y 18): mezclarlos aqui convertiria la lista de
 * trabajo diario en un listin de todo el mundo.
 */
export default function Cartera(): React.JSX.Element {
  const { estado: sesion } = useSesion()
  const router = useRouter()

  const [texto, setTexto] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState<EstadoUsuario | null>(null)
  const [intento, setIntento] = useState(0)

  const [fase, setFase] = useState<Fase>("cargando")
  const [actualizando, setActualizando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [clientes, setClientes] = useState<ResumenUsuario[]>([])
  const [total, setTotal] = useState(0)
  const [fallo, setFallo] = useState<Fallo>({ texto: "", reintentable: true })

  const tokenAcceso = sesion.fase === "dentro" ? sesion.tokenAcceso : null

  // Preguntar en cada pulsacion son diez peticiones para escribir "Fernandez", y
  // las respuestas pueden llegar desordenadas. Se espera a que pare de teclear.
  useEffect(() => {
    const reloj = setTimeout(() => {
      setBusqueda(texto.trim())
    }, ESPERA_DE_BUSQUEDA_MS)

    return () => {
      clearTimeout(reloj)
    }
  }, [texto])

  useEffect(() => {
    if (tokenAcceso === null) {
      return
    }

    // React ejecuta esta limpieza antes de volver a lanzar el efecto, asi que
    // una respuesta lenta de una busqueda anterior llega con `vigente` en falso
    // y no pisa a la busqueda actual.
    let vigente = true
    setActualizando(true)

    listarUsuarios(tokenAcceso, {
      rol: "cliente",
      buscar: busqueda === "" ? undefined : busqueda,
      estado: filtro ?? undefined,
      limite: LIMITE,
      desde: 0,
    })
      .then((listado) => {
        if (!vigente) return

        setClientes(listado.usuarios)
        setTotal(listado.total)
        setFase("listo")
        setActualizando(false)
        setRefrescando(false)
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setFallo(faltaDe(error))
        setFase("error")
        setActualizando(false)
        setRefrescando(false)
      })

    return () => {
      vigente = false
    }
  }, [tokenAcceso, busqueda, filtro, intento])

  const hayFiltroPuesto = busqueda !== "" || filtro !== null
  const recortada = clientes.length < total

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>TU CARTERA</Text>
        <Pressable
          onPress={() => {
            router.back()
          }}
          accessibilityRole="button"
          hitSlop={12}
        >
          <Text style={estilos.volver}>VOLVER</Text>
        </Pressable>
      </View>

      <View style={estilos.buscador}>
        <TextInput
          style={estilos.campo}
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar por nombre, apellidos o correo"
          placeholderTextColor={tema.textoTenue}
          accessibilityLabel="Buscar cliente"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {actualizando && <ActivityIndicator color={tema.oro} style={estilos.girando} />}
      </View>

      <View style={estilos.filtros}>
        {FILTROS.map((opcion) => {
          const puesto = opcion.estado === filtro

          return (
            <Pressable
              key={opcion.etiqueta}
              style={[estilos.filtro, puesto && estilos.filtroPuesto]}
              onPress={() => {
                setFiltro(opcion.estado)
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: puesto }}
            >
              <Text style={[estilos.textoFiltro, puesto && estilos.textoFiltroPuesto]}>
                {opcion.etiqueta}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {fase === "cargando" ? (
        <View style={estilos.centrado}>
          <ActivityIndicator
            color={tema.oro}
            size="large"
            accessibilityLabel="Cargando tu cartera"
          />
        </View>
      ) : fase === "error" ? (
        <View style={estilos.centrado}>
          <Text style={estilos.aviso} accessibilityRole="alert">
            {fallo.texto}
          </Text>
          {fallo.reintentable && (
            <Pressable
              style={({ pressed }) => [estilos.boton, pressed && estilos.pulsado]}
              onPress={() => {
                setIntento((n) => n + 1)
              }}
              accessibilityRole="button"
            >
              <Text style={estilos.textoBoton}>REINTENTAR</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(cliente) => cliente.id}
          contentContainerStyle={estilos.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true)
                setIntento((n) => n + 1)
              }}
              tintColor={tema.oro}
              colors={[tema.oro]}
            />
          }
          renderItem={({ item }) => <Fila cliente={item} />}
          ListEmptyComponent={
            <Text style={estilos.vacio}>
              {hayFiltroPuesto
                ? "Nadie de tu cartera coincide con esa búsqueda."
                : "Todavía no tienes clientes. Cuando des de alta al primero aparecerá aquí."}
            </Text>
          }
          ListFooterComponent={
            recortada ? (
              <Text style={estilos.pie}>
                {`Mostrando ${String(clientes.length)} de ${String(total)}. Busca por nombre para encontrar al resto.`}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

function Fila({ cliente }: { cliente: ResumenUsuario }): React.JSX.Element {
  const nombreCompleto = [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")
  const deBaja = cliente.estado === "desactivado"

  return (
    <View
      style={[estilos.fila, deBaja && estilos.filaApagada]}
      // Un lector de pantalla lee la fila entera de una vez en lugar de tres
      // trozos sueltos, que es como se pierde el estado.
      accessible
      accessibilityLabel={`${nombreCompleto}. ${ETIQUETA_DE_ESTADO[cliente.estado]}. ${cliente.email}`}
    >
      <View style={estilos.datos}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {nombreCompleto}
        </Text>
        <Text style={estilos.correo} numberOfLines={1}>
          {cliente.email}
        </Text>
      </View>

      <View style={[estilos.insignia, estilos[cliente.estado]]}>
        <Text style={[estilos.textoInsignia, estilos[`texto_${cliente.estado}`]]}>
          {ETIQUETA_DE_ESTADO[cliente.estado]}
        </Text>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
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
  buscador: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 10 },
  campo: {
    flex: 1,
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    color: tema.texto,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  girando: { width: 20 },
  filtros: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filtro: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filtroPuesto: { backgroundColor: tema.oro, borderColor: tema.oro },
  textoFiltro: { color: tema.textoTenue, fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  textoFiltroPuesto: { color: tema.fondo },
  lista: { padding: 20, gap: 10, flexGrow: 1 },
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
  filaApagada: { opacity: 0.55 },
  datos: { flex: 1, gap: 3 },
  nombre: { color: tema.texto, fontSize: 16 },
  correo: { color: tema.textoTenue, fontSize: 12 },
  insignia: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  textoInsignia: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  pendiente: { backgroundColor: "#2A2413", borderColor: tema.oro },
  activo: { backgroundColor: "transparent", borderColor: tema.borde },
  desactivado: { backgroundColor: "transparent", borderColor: tema.borde },
  texto_pendiente: { color: tema.oroSuave },
  texto_activo: { color: tema.texto },
  texto_desactivado: { color: tema.textoTenue },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  aviso: { color: tema.texto, fontSize: 15, textAlign: "center" },
  vacio: {
    color: tema.textoTenue,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 40,
  },
  pie: { color: tema.textoTenue, fontSize: 12, textAlign: "center", marginTop: 12, lineHeight: 18 },
  boton: {
    borderColor: tema.oro,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  pulsado: { opacity: 0.6 },
  textoBoton: { color: tema.oro, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
})
