import { useFocusEffect, useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import type { EstadoUsuario, ResumenUsuario } from "@alpha-omega/shared"
import Svg, { Circle, Path } from "react-native-svg"

import { Aviso } from "../src/componentes/aviso"
import { BotonPrincipal, BotonSecundario } from "../src/componentes/botones"
import { Esqueleto, GrupoEsqueletos } from "../src/componentes/esqueleto"
import { Icono } from "../src/componentes/iconos"
import { ETIQUETA_DE_ESTADO, InsigniaDeEstado } from "../src/componentes/insignia-estado"
import { Pulsable } from "../src/componentes/pulsable"
import { listarUsuarios } from "../src/lib/api"
import { faltaDe, type Falta } from "../src/lib/errores"
import { useSesion } from "../src/sesion"
import { alto, espacio, radio, tema, tipo } from "../src/tema"

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
  { etiqueta: "PENDIENTES DE ACTIVAR", estado: "pendiente" },
  { etiqueta: "ACTIVOS", estado: "activo" },
  { etiqueta: "DE BAJA", estado: "desactivado" },
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
  const { estado: sesion, pedir } = useSesion()
  const router = useRouter()

  const [texto, setTexto] = useState("")
  const [enfocado, setEnfocado] = useState(false)
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

    listarUsuarios(pedir, {
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
  }, [tokenAcceso, pedir, busqueda, filtro, intento])

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
    <SafeAreaView edges={["left", "right"]} style={estilos.pantalla}>
      <View style={estilos.margenBuscador}>
        <View style={[estilos.buscador, enfocado && estilos.buscadorEnfocado]}>
          <View aria-hidden>
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Circle cx={10} cy={10} r={6} fill="none" stroke={tema.textoTenue} strokeWidth={2} />
              <Path d="M15 15l5 5" stroke={tema.textoTenue} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <TextInput
            style={estilos.campo}
            value={texto}
            onChangeText={setTexto}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setEnfocado(false)}
            placeholder="Buscar por nombre y apellidos"
            placeholderTextColor={tema.textoTenue}
            selectionColor={tema.acento}
            accessibilityLabel="Buscar cliente"
            accessibilityState={{ busy: actualizando }}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      </View>

      {fase === "cargando" ? (
        <CargaCartera />
      ) : (
        <>
          <ScrollView
            testID="filtros-cartera"
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={estilos.filtros}
            style={estilos.tiraFiltros}
            keyboardShouldPersistTaps="handled"
          >
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
                  accessibilityLabel={opcion.etiqueta}
                  accessibilityState={{ selected: puesto }}
                  hitSlop={2}
                >
                  <Text style={[estilos.textoFiltro, puesto && estilos.textoFiltroPuesto]}>
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {fase === "error" ? (
            <View style={estilos.error}>
              <Aviso
                mensaje={fallo.texto}
                tipo="error"
                alReintentar={fallo.reintentable ? () => setIntento((n) => n + 1) : undefined}
              />
            </View>
          ) : (
            <View style={estilos.flexible}>
              <FlatList
                data={clientes}
                keyExtractor={(cliente) => cliente.id}
                contentContainerStyle={estilos.lista}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                refreshControl={
                  <RefreshControl
                    refreshing={refrescando}
                    onRefresh={() => {
                      setRefrescando(true)
                      setIntento((n) => n + 1)
                    }}
                    tintColor={tema.acento}
                    colors={[tema.acento]}
                  />
                }
                renderItem={({ item }) => (
                  <Fila
                    cliente={item}
                    onAbrir={() => {
                      router.push({ pathname: "/entrenador/cliente/[id]", params: { id: item.id } })
                    }}
                  />
                )}
                ListEmptyComponent={
                  <View style={estilos.vacio}>
                    <Icono nombre="clientes" color={tema.textoTenue} tamano={48} />
                    <Text style={estilos.textoVacio} accessibilityRole="header">
                      {hayFiltroPuesto ? "Nadie coincide" : "Aún no tienes clientes"}
                    </Text>
                    {!hayFiltroPuesto && (
                      <BotonSecundario
                        texto="Dar de alta"
                        sinMargen
                        onPress={() => router.push("/cliente/nuevo")}
                      />
                    )}
                  </View>
                }
                ListFooterComponent={
                  recortada ? (
                    <Text style={estilos.pie}>
                      {`Mostrando ${String(clientes.length)} de ${String(total)}`}
                    </Text>
                  ) : undefined
                }
              />
            </View>
          )}
        </>
      )}
      <View testID="nuevo-cliente" style={estilos.nuevo}>
        <BotonPrincipal
          texto="+ NUEVO"
          sinMargen
          compacto
          etiquetaAccesible="Dar de alta a un cliente nuevo"
          onPress={() => router.push("/cliente/nuevo")}
        />
      </View>
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
    <Pulsable
      style={[estilos.fila, deBaja && estilos.filaApagada]}
      onPress={onAbrir}
      // Un lector de pantalla lee la fila entera de una vez en lugar de tres
      // trozos sueltos, que es como se pierde el estado.
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${nombreCompleto}. ${ETIQUETA_DE_ESTADO[cliente.estado]}. ${cliente.email}`}
      accessibilityHint="Abre su ficha"
    >
      <View testID={`avatar-${cliente.id}`} style={estilos.avatar}>
        <Text style={estilos.inicial}>{cliente.nombre.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={estilos.datos}>
        <Text style={estilos.nombre} numberOfLines={1}>
          {nombreCompleto}
        </Text>
        <Text style={estilos.correo} numberOfLines={1}>
          {cliente.email}
        </Text>
      </View>

      <InsigniaDeEstado estado={cliente.estado} />
    </Pulsable>
  )
}

function CargaCartera(): React.JSX.Element {
  return (
    <View accessibilityLabel="Cargando tu cartera" accessibilityState={{ busy: true }}>
      <GrupoEsqueletos>
        <View style={estilos.filtros}>
          {[80, 112, 88].map((ancho) => (
            <View key={ancho} testID="chip-esqueleto-cartera">
              <Esqueleto ancho={ancho} alto={40} radio={radio.pastilla} />
            </View>
          ))}
        </View>
        <View style={estilos.lista}>
          {[0, 1, 2, 3, 4].map((indice) => (
            <View key={indice} testID="fila-esqueleto-cartera" style={estilos.fila}>
              <Esqueleto ancho={44} alto={44} radio={radio.campo} />
              <View style={estilos.datos}>
                <Esqueleto ancho="80%" alto={18} />
                <Esqueleto ancho="60%" alto={12} />
              </View>
            </View>
          ))}
        </View>
      </GrupoEsqueletos>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "transparent" },
  flexible: { flex: 1 },
  margenBuscador: { paddingHorizontal: espacio[20], paddingTop: espacio[8] },
  buscador: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: espacio[12],
    gap: espacio[8],
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    borderRadius: radio.campo,
  },
  buscadorEnfocado: { borderColor: tema.acento },
  campo: {
    ...tipo.cuerpo,
    flex: 1,
    minWidth: 0,
    color: tema.texto,
    minHeight: alto.campo,
    paddingVertical: espacio[12],
  },
  tiraFiltros: { flexGrow: 0, flexShrink: 0 },
  filtros: {
    flexDirection: "row",
    gap: espacio[8],
    paddingHorizontal: espacio[20],
    paddingTop: espacio[16],
    paddingBottom: espacio[16],
  },
  filtro: {
    borderColor: tema.bordeFuerte,
    borderWidth: 1,
    borderRadius: radio.pastilla,
    paddingHorizontal: espacio[12],
    height: 40,
    justifyContent: "center",
  },
  filtroPuesto: { backgroundColor: tema.acentoSuave, borderColor: tema.acento },
  textoFiltro: {
    fontFamily: tema.fuenteSemi,
    color: tema.textoTenue,
    fontSize: 12,
    letterSpacing: 1,
  },
  textoFiltroPuesto: { color: tema.acento },
  lista: { paddingHorizontal: espacio[20], paddingBottom: 92, gap: espacio[8], flexGrow: 1 },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: radio.tarjetaInterna,
    paddingHorizontal: espacio[12],
    paddingVertical: espacio[12],
    minHeight: 72,
    gap: espacio[12],
  },
  filaApagada: { opacity: 0.55 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radio.campo,
    backgroundColor: tema.fondo,
    alignItems: "center",
    justifyContent: "center",
  },
  inicial: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  datos: { flex: 1, minWidth: 0, gap: espacio[4] },
  nombre: { ...tipo.fila, color: tema.texto },
  correo: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 12 },
  error: { paddingHorizontal: espacio[20] },
  vacio: { alignItems: "center", gap: espacio[20], paddingVertical: 64 },
  textoVacio: { ...tipo.titulo, color: tema.texto, textAlign: "center" },
  pie: {
    ...tipo.secundario,
    textAlign: "center",
    marginTop: espacio[12],
  },
  nuevo: { position: "absolute", right: espacio[20], bottom: espacio[20], minWidth: 124 },
})
