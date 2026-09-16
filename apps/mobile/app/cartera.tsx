import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
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

import { ETIQUETA_DE_ESTADO, InsigniaDeEstado } from "../src/componentes/insignia-estado"
import { listarUsuarios } from "../src/lib/api"
import { faltaDe, type Falta } from "../src/lib/errores"
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

type Fase = "cargando" | "listo" | "error"

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
  const [fallo, setFallo] = useState<Falta>({
    texto: "",
    reintentable: true,
    sesionCaducada: false,
  })

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

        setFallo(faltaDe(error, "No hemos podido cargar tu cartera."))
        setFase("error")
        setActualizando(false)
        setRefrescando(false)
      })

    return () => {
      vigente = false
    }
  }, [tokenAcceso, busqueda, filtro, intento])

  // Al volver de una ficha, la lista se vuelve a pedir. Sin esto, dar de baja a
  // alguien y pulsar VOLVER lo dejaria pintado como ACTIVO, y en una pantalla de
  // permisos eso no es un detalle visual: es una mentira sobre quien tiene acceso.
  const primerFoco = useRef(true)
  useFocusEffect(
    useCallback(() => {
      if (primerFoco.current) {
        // El efecto de arriba ya ha pedido la lista al montar la pantalla.
        primerFoco.current = false
        return
      }

      setIntento((n) => n + 1)
    }, []),
  )

  const hayFiltroPuesto = busqueda !== "" || filtro !== null
  const recortada = clientes.length < total

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>TU CARTERA</Text>
        <View style={estilos.accionesCabecera}>
          <Pressable
            onPress={() => {
              router.push("/cliente/nuevo")
            }}
            accessibilityRole="button"
            accessibilityLabel="Dar de alta a un cliente nuevo"
            hitSlop={12}
          >
            <Text style={estilos.nuevo}>+ NUEVO</Text>
          </Pressable>
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
          renderItem={({ item }) => (
            <Fila
              cliente={item}
              onAbrir={() => {
                router.push({ pathname: "/cliente/[id]", params: { id: item.id } })
              }}
            />
          )}
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

function Fila({
  cliente,
  onAbrir,
}: {
  cliente: ResumenUsuario
  onAbrir: () => void
}): React.JSX.Element {
  const nombreCompleto = [cliente.nombre, cliente.apellidos].filter(Boolean).join(" ")
  const deBaja = cliente.estado === "desactivado"

  return (
    <Pressable
      style={({ pressed }) => [
        estilos.fila,
        deBaja && estilos.filaApagada,
        pressed && estilos.filaPulsada,
      ]}
      onPress={onAbrir}
      // Un lector de pantalla lee la fila entera de una vez en lugar de tres
      // trozos sueltos, que es como se pierde el estado.
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${nombreCompleto}. ${ETIQUETA_DE_ESTADO[cliente.estado]}. ${cliente.email}`}
      accessibilityHint="Abre su ficha"
    >
      <View style={estilos.datos}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {nombreCompleto}
        </Text>
        <Text style={estilos.correo} numberOfLines={1}>
          {cliente.email}
        </Text>
      </View>

      <InsigniaDeEstado estado={cliente.estado} />
    </Pressable>
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
  accionesCabecera: { flexDirection: "row", alignItems: "center", gap: 16 },
  nuevo: { color: tema.oro, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
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
  filaPulsada: { borderColor: tema.oro },
  datos: { flex: 1, gap: 3 },
  nombre: { color: tema.texto, fontSize: 16 },
  correo: { color: tema.textoTenue, fontSize: 12 },
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
