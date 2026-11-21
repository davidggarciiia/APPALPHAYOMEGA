import { useEffect, useRef, useState } from "react"
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
import type { Ejercicio, GrupoMuscular } from "@alpha-omega/shared"

import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"

import type { ApiDeCatalogo } from "./api"
import { FiltroDeGrupo } from "./filtro-de-grupo"
import { ETIQUETA_DE_GRUPO } from "./grupos"

export { ETIQUETA_DE_GRUPO }

/**
 * Cuántos ejercicios se piden de una vez. El catálogo pasa del millar: la lista
 * sigue pidiendo páginas al llegar al final, con un botón por si el gesto no basta.
 */
const POR_PAGINA = 50

/** Cuánto se espera a que el entrenador deje de teclear antes de preguntar. */
const ESPERA_DE_BUSQUEDA_MS = 300

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
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState(false)
  /** Cuenta las consultas: una página tardía de una búsqueda anterior no se añade. */
  const consulta = useRef(0)
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
    consulta.current += 1
    setActualizando(true)
    setCargandoMas(false)
    setErrorMas(false)

    api
      .buscar({
        buscar: busqueda === "" ? undefined : busqueda,
        grupo: grupo ?? undefined,
        estado: verRetirados ? "retirado" : "publicado",
        limite: POR_PAGINA,
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

        setFallo(faltaDe(error, "No hemos podido cargar los ejercicios."))
        setFase("error")
        setActualizando(false)
        setRefrescando(false)
      })

    return () => {
      vigente = false
    }
  }, [api, busqueda, grupo, verRetirados, intento])

  const cargarMas = (): void => {
    if (cargandoMas || actualizando || ejercicios.length >= total) return
    const esta = consulta.current
    setCargandoMas(true)
    setErrorMas(false)

    api
      .buscar({
        buscar: busqueda === "" ? undefined : busqueda,
        grupo: grupo ?? undefined,
        estado: verRetirados ? "retirado" : "publicado",
        limite: POR_PAGINA,
        desplazamiento: ejercicios.length,
      })
      .then((listado) => {
        if (consulta.current !== esta) return

        const vistos = new Set(ejercicios.map((fila) => fila.id))
        const nuevos = listado.ejercicios.filter((fila) => !vistos.has(fila.id))
        setEjercicios([...ejercicios, ...nuevos])
        // Si el servidor no da nada nuevo, no se insiste: así no hay bucle si el total miente.
        setTotal(nuevos.length === 0 ? ejercicios.length : listado.total)
        setCargandoMas(false)
      })
      .catch(() => {
        if (consulta.current !== esta) return

        setErrorMas(true)
        setCargandoMas(false)
      })
  }

  const hayFiltroPuesto = busqueda !== "" || grupo !== null
  const recortada = ejercicios.length < total

  return (
    <SafeAreaView edges={["left", "right"]} style={estilos.pantalla}>
      <View style={estilos.cabecera}>
        <Text accessibilityRole="header" style={estilos.titulo}>
          Ejercicios
        </Text>
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
              Retirados
            </Text>
          </Pressable>
          <Pressable
            onPress={onNuevo}
            accessibilityRole="button"
            accessibilityLabel="Crear un ejercicio nuevo"
            hitSlop={12}
          >
            <Text style={estilos.nuevo}>+ Nuevo</Text>
          </Pressable>
        </View>
      </View>

      <View style={estilos.buscador}>
        <TextInput
          style={estilos.campo}
          value={texto}
          onChangeText={(valor) => setTexto(valor.slice(0, 120))}
          maxLength={120}
          placeholder="Buscar por nombre"
          placeholderTextColor={tema.textoTenue}
          accessibilityLabel="Buscar ejercicio"
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {actualizando && <ActivityIndicator color={tema.acento} style={estilos.girando} />}
      </View>

      {/* Doce filtros en vertical se comen media pantalla; en una fila se deslizan. */}
      <FiltroDeGrupo grupo={grupo} cambiar={setGrupo} margenHorizontal={16} />

      {fase === "cargando" ? (
        <View style={estilos.centrado}>
          <ActivityIndicator
            color={tema.acento}
            size="large"
            accessibilityLabel="Cargando los ejercicios"
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
              accessibilityLabel="Reintentar"
            >
              <Text style={estilos.textoBoton}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          testID="lista-ejercicios"
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
              tintColor={tema.acento}
              colors={[tema.acento]}
            />
          }
          onEndReached={cargarMas}
          onEndReachedThreshold={0.5}
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
                  : "Todavía no hay ejercicios. Crea el primero con «+ Nuevo»."}
            </Text>
          }
          ListFooterComponent={
            recortada ? (
              <View style={estilos.pieCarga}>
                <Text style={estilos.pie}>
                  {`Mostrando ${String(ejercicios.length)} de ${String(total)}.`}
                </Text>
                {errorMas && (
                  <Text style={estilos.pie} accessibilityRole="alert">
                    No hemos podido cargar más ejercicios.
                  </Text>
                )}
                {cargandoMas ? (
                  <ActivityIndicator
                    color={tema.acento}
                    accessibilityLabel="Cargando más ejercicios"
                  />
                ) : (
                  <Pressable
                    style={({ pressed }) => [estilos.botonMas, pressed && estilos.pulsado]}
                    onPress={cargarMas}
                    accessibilityRole="button"
                    accessibilityLabel={
                      errorMas ? "Reintentar cargar más" : "Cargar más ejercicios"
                    }
                  >
                    <Text style={estilos.textoBoton}>{errorMas ? "Reintentar" : "Cargar más"}</Text>
                  </Pressable>
                )}
              </View>
            ) : undefined
          }
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titulo: {
    color: tema.texto,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: tema.fuenteTitulo,
    textTransform: "uppercase",
  },
  accionesCabecera: { flexDirection: "row", alignItems: "center", gap: 16 },
  nuevo: {
    fontFamily: tema.fuenteBoton,
    color: tema.acento,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  retirados: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  retiradosPuesto: { fontFamily: tema.fuenteBoton, color: tema.acento },
  buscador: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 10 },
  campo: {
    flex: 1,
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 14,
    color: tema.texto,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  girando: { width: 20 },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  fila: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 3,
  },
  filaApagada: { opacity: 0.55 },
  filaPulsada: { borderColor: tema.acento },
  nombre: { color: tema.texto, fontSize: 17, fontFamily: tema.fuenteBoton },
  grupos: { fontFamily: tema.fuenteTexto, color: tema.textoTenue, fontSize: 12 },
  marcaRetirado: {
    fontFamily: tema.fuenteBoton,
    color: tema.error,
    fontSize: 10,
    letterSpacing: 2,
  },
  centrado: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  aviso: { fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 15, textAlign: "center" },
  vacio: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 40,
  },
  pie: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
  },
  boton: {
    borderColor: tema.acento,
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  pulsado: { opacity: 0.6 },
  textoBoton: {
    fontFamily: tema.fuenteBoton,
    color: tema.acento,
    fontSize: 13,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  pieCarga: { alignItems: "center", gap: 8, marginTop: 4 },
  botonMas: {
    borderColor: tema.acento,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
})
