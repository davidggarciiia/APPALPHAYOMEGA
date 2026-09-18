import { useEffect, useState } from "react"
import {
  ActivityIndicator,
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
import { GRUPOS_MUSCULARES, type Ejercicio, type GrupoMuscular } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"

import type { ApiDeCatalogo } from "./api"

/**
 * El máximo que admite el contrato. Si algún día no basta, la pantalla lo dice
 * con «mostrando 100 de 130» en lugar de cortar la lista en silencio.
 */
const LIMITE = 100

/** Cuánto se espera a que el entrenador deje de teclear antes de preguntar. */
const ESPERA_DE_BUSQUEDA_MS = 300

/**
 * Cómo se lee cada grupo. El vocabulario viaja sin acentos y aquí se escribe
 * bien. Al ser un `Record`, añadir un grupo al contrato no compila sin su nombre.
 */
export const ETIQUETA_DE_GRUPO: Record<GrupoMuscular, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazos: "Antebrazos",
  abdomen: "Abdomen",
  gluteos: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  gemelos: "Gemelos",
}

type Fase = "cargando" | "listo" | "error"

/**
 * El catálogo que mantiene el entrenador.
 *
 * No sabe de rutas ni de sesión: recibe la API y avisa de a dónde quiere ir. Así
 * se prueba entera sin simular el navegador, y la ruta decide qué es «abrir».
 */
export function Catalogo({
  api,
  onNuevo,
  onAbrir,
}: {
  api: ApiDeCatalogo
  onNuevo: () => void
  onAbrir: (id: string) => void
}): React.JSX.Element {
  const [texto, setTexto] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [grupo, setGrupo] = useState<GrupoMuscular | null>(null)
  const [verRetirados, setVerRetirados] = useState(false)
  const [intento, setIntento] = useState(0)

  const [fase, setFase] = useState<Fase>("cargando")
  const [actualizando, setActualizando] = useState(false)
  const [refrescando, setRefrescando] = useState(false)
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([])
  const [total, setTotal] = useState(0)
  const [fallo, setFallo] = useState<Falta>({
    texto: "",
    reintentable: true,
    sesionCaducada: false,
  })

  useEffect(() => {
    const reloj = setTimeout(() => {
      setBusqueda(texto.trim())
    }, ESPERA_DE_BUSQUEDA_MS)

    return () => {
      clearTimeout(reloj)
    }
  }, [texto])

  useEffect(() => {
    // Una respuesta lenta de una búsqueda anterior llega con `vigente` en falso
    // y no pisa a la búsqueda actual.
    let vigente = true
    setActualizando(true)

    api
      .buscar({
        buscar: busqueda === "" ? undefined : busqueda,
        grupo: grupo ?? undefined,
        estado: verRetirados ? "retirado" : "publicado",
        limite: LIMITE,
      })
      .then((listado) => {
        if (!vigente) return

        setEjercicios(listado.ejercicios)
        setTotal(listado.total)
        setFase("listo")
        setActualizando(false)
        setRefrescando(false)
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setFallo(faltaDe(error, "No hemos podido cargar el catálogo."))
        setFase("error")
        setActualizando(false)
        setRefrescando(false)
      })

    return () => {
      vigente = false
    }
  }, [api, busqueda, grupo, verRetirados, intento])

  const hayFiltroPuesto = busqueda !== "" || grupo !== null
  const recortada = ejercicios.length < total

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text style={estilos.titulo}>CATÁLOGO</Text>
        <View style={estilos.accionesCabecera}>
          {/* Los retirados no se mezclan con los vigentes: se piden aparte. */}
          <Pressable
            onPress={() => {
              setVerRetirados((ver) => !ver)
            }}
            accessibilityRole="button"
            accessibilityLabel="Ver los ejercicios retirados"
            accessibilityState={{ selected: verRetirados }}
            hitSlop={12}
          >
            <Text style={[estilos.retirados, verRetirados && estilos.retiradosPuesto]}>
              RETIRADOS
            </Text>
          </Pressable>
          <Pressable
            onPress={onNuevo}
            accessibilityRole="button"
            accessibilityLabel="Crear un ejercicio nuevo"
            hitSlop={12}
          >
            <Text style={estilos.nuevo}>+ NUEVO</Text>
          </Pressable>
        </View>
      </View>

      <View style={estilos.buscador}>
        <TextInput
          style={estilos.campo}
          value={texto}
          onChangeText={setTexto}
          placeholder="Buscar por nombre"
          placeholderTextColor={tema.textoTenue}
          accessibilityLabel="Buscar ejercicio"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {actualizando && <ActivityIndicator color={tema.oro} style={estilos.girando} />}
      </View>

      {/* Doce filtros en vertical se comen media pantalla; en una fila se deslizan. */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={estilos.filtros}
          keyboardShouldPersistTaps="handled"
        >
          <Filtro
            texto="TODOS"
            nombre="Quitar el filtro de grupo"
            puesto={grupo === null}
            onPress={() => {
              setGrupo(null)
            }}
          />
          {GRUPOS_MUSCULARES.map((opcion) => (
            <Filtro
              key={opcion}
              texto={ETIQUETA_DE_GRUPO[opcion].toUpperCase()}
              nombre={`Filtrar por ${ETIQUETA_DE_GRUPO[opcion]}`}
              puesto={opcion === grupo}
              onPress={() => {
                setGrupo(opcion)
              }}
            />
          ))}
        </ScrollView>
      </View>

      {fase === "cargando" ? (
        <View style={estilos.centrado}>
          <ActivityIndicator
            color={tema.oro}
            size="large"
            accessibilityLabel="Cargando el catálogo"
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
                setFase("cargando")
                setIntento((n) => n + 1)
              }}
              accessibilityRole="button"
              accessibilityLabel="REINTENTAR"
            >
              <Text style={estilos.textoBoton}>REINTENTAR</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={ejercicios}
          keyExtractor={(fila) => fila.id}
          contentContainerStyle={estilos.lista}
          keyboardShouldPersistTaps="handled"
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
              ejercicio={item}
              onAbrir={() => {
                onAbrir(item.id)
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={estilos.vacio}>
              {hayFiltroPuesto
                ? "Ningún ejercicio coincide con esa búsqueda."
                : verRetirados
                  ? "No hay ejercicios retirados."
                  : "Todavía no hay ejercicios. Crea el primero con + NUEVO."}
            </Text>
          }
          ListFooterComponent={
            recortada ? (
              <Text style={estilos.pie}>
                {`Mostrando ${String(ejercicios.length)} de ${String(total)}. Busca por nombre para encontrar el resto.`}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

function Filtro({
  texto,
  nombre,
  puesto,
  onPress,
}: {
  texto: string
  nombre: string
  puesto: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      style={[estilos.filtro, puesto && estilos.filtroPuesto]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={nombre}
      accessibilityState={{ selected: puesto }}
      hitSlop={6}
    >
      <Text style={[estilos.textoFiltro, puesto && estilos.textoFiltroPuesto]}>{texto}</Text>
    </Pressable>
  )
}

function Fila({
  ejercicio,
  onAbrir,
}: {
  ejercicio: Ejercicio
  onAbrir: () => void
}): React.JSX.Element {
  const principal = ETIQUETA_DE_GRUPO[ejercicio.grupoPrincipal]
  const secundarios = ejercicio.gruposSecundarios.map((grupo) => ETIQUETA_DE_GRUPO[grupo])
  const retirado = ejercicio.estado === "retirado"

  return (
    <Pressable
      style={({ pressed }) => [
        estilos.fila,
        retirado && estilos.filaApagada,
        pressed && estilos.filaPulsada,
      ]}
      onPress={onAbrir}
      // Un lector de pantalla lee la fila de una vez y no en trozos sueltos.
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${ejercicio.nombre}. ${principal}${retirado ? ". Retirado" : ""}`}
      accessibilityHint="Abre el ejercicio para editarlo"
    >
      <Text style={estilos.nombre} numberOfLines={1}>
        {ejercicio.nombre}
      </Text>
      <Text style={estilos.grupos} numberOfLines={1}>
        {[principal, ...secundarios].join(" · ")}
      </Text>
      {retirado && <Text style={estilos.marcaRetirado}>RETIRADO</Text>}
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
  retirados: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
  retiradosPuesto: { color: tema.oro, fontWeight: "700" },
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
  filtros: { gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  filtro: {
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filtroPuesto: { backgroundColor: tema.oro, borderColor: tema.oro },
  textoFiltro: { color: tema.textoTenue, fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  textoFiltroPuesto: { color: tema.fondo },
  lista: { padding: 20, gap: 10, flexGrow: 1 },
  fila: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 3,
  },
  filaApagada: { opacity: 0.55 },
  filaPulsada: { borderColor: tema.oro },
  nombre: { color: tema.texto, fontSize: 16 },
  grupos: { color: tema.textoTenue, fontSize: 12 },
  marcaRetirado: { color: tema.error, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
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
