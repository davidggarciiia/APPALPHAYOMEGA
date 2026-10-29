import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect, useRouter } from "expo-router"
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import Animated, { useSharedValue } from "react-native-reanimated"
import type { SesionEntrenador, ResultadoEntrenamiento } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { AvisoDeError, BotonEnlace, BotonPrincipal, vibrar } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { caida, useDestello, useMovimientoReducido } from "../componentes/movimiento"
import { espacio, tema, tipo } from "../tema"
import { resumenDeResultado } from "./ficha-modelo"
import { EjerciciosRevision } from "./ejercicios-revision"

type Propiedades = {
  id: string
  api: ApiEntrenamiento
  nombreCliente?: string
  salir?: () => void
  nuevoId?: () => string
}

export function DetalleEntrenador(props: Propiedades): React.JSX.Element {
  return <RevisionSesion key={props.id} {...props} />
}

function RevisionSesion({
  id,
  api,
  nombreCliente = "Cliente",
  salir,
  nuevoId,
}: Propiedades): React.JSX.Element {
  const [sesion, setSesion] = useState<SesionEntrenador | null>(null)
  const [resultado, setResultado] = useState<ResultadoEntrenamiento | undefined>()
  const [error, setError] = useState("")
  const [errorRevision, setErrorRevision] = useState("")
  const [intento, setIntento] = useState(0)
  const [revisando, setRevisando] = useState(false)
  const revisionEnCurso = useRef(false)
  const vigente = useRef(true)
  useEffect(() => {
    vigente.current = true
    return () => {
      vigente.current = false
    }
  }, [])
  const router = useRouter()
  const reducido = useMovimientoReducido()
  const ancho = useSharedValue(0)
  const destello = useDestello(ancho)
  const completada = Boolean(sesion?.enviadoEn && sesion.revisadaEn && resultado && !error)
  useFocusEffect(
    useCallback(() => {
      if (completada) return
      let vigente = true,
        cargando = false,
        enviada = false
      const cargar = async (): Promise<void> => {
        if (
          !vigente ||
          cargando ||
          (AppState.currentState !== null && AppState.currentState !== "active")
        )
          return
        cargando = true
        try {
          const lectura = api.leerEntrenador(id)
          const [s, r] = await Promise.allSettled([
            lectura,
            enviada
              ? api.resultado(id)
              : lectura.then((s) => (vigente && s.enviadoEn ? api.resultado(id) : undefined)),
          ])
          if (vigente) {
            if (s.status === "fulfilled") {
              setSesion(s.value)
              enviada = Boolean(s.value.enviadoEn)
            }
            if (r.status === "fulfilled") setResultado(r.value)
            setError(
              s.status === "rejected" || r.status === "rejected"
                ? "No se pudo actualizar el entrenamiento."
                : "",
            )
          }
        } catch {
          if (vigente) setError("No se pudo actualizar el entrenamiento.")
        } finally {
          cargando = false
        }
      }
      void cargar()
      const reloj = setInterval(() => void cargar(), 5000)
      const actividad = AppState.addEventListener("change", (s) => {
        if (s === "active") void cargar()
      })
      return () => {
        vigente = false
        clearInterval(reloj)
        actividad.remove()
      }
    }, [id, api, intento, completada]),
  )
  const revisar = async (): Promise<void> => {
    if (revisionEnCurso.current || sesion?.revisadaEn || !resultado) return
    revisionEnCurso.current = true
    setRevisando(true)
    setErrorRevision("")
    try {
      const actualizada = await api.revisar(id)
      if (!vigente.current) return
      setSesion(actualizada)
      destello.disparar()
      vibrar("exito")
    } catch {
      if (vigente.current) setErrorRevision("No se pudo guardar la revisión. Reintenta.")
    } finally {
      revisionEnCurso.current = false
      if (vigente.current) setRevisando(false)
    }
  }
  const volver = (): void => {
    if (salir) return salir()
    if (router.canGoBack()) router.back()
    else router.replace("/cartera")
  }
  const fecha =
    sesion &&
    new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${sesion.agenda.fechaActual}T00:00:00Z`))
  const resumen = resultado && resumenDeResultado(resultado)
  return (
    <SafeAreaView edges={["left", "right"]} style={s.pantalla}>
      <KeyboardAvoidingView
        style={s.pantalla}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.barraSuperior}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={volver}
            style={s.volver}
          >
            <Icono nombre="atras" tamano={20} color={tema.texto} />
          </Pressable>
          <Text style={s.tenue}>{nombreCliente}</Text>
        </View>
        <ScrollView
          style={s.pantalla}
          contentContainerStyle={s.contenido}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {error !== "" && (
            <View>
              <AvisoDeError mensaje={error} />
              <BotonEnlace texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
            </View>
          )}
          {sesion ? (
            <Animated.View entering={caida(0, reducido)} style={s.sesion}>
              <View style={s.cabecera}>
                <Text style={s.titulo} accessibilityRole="header">
                  {sesion.prescripcion.nombre}
                </Text>
                {sesion.enviadoEn && (
                  <Text style={[s.insignia, sesion.revisadaEn ? s.revisada : s.sinRevisar]}>
                    {sesion.revisadaEn ? "Revisada" : "Sin revisar"}
                  </Text>
                )}
                <Text style={s.tenue}>{[fecha, resumen].filter(Boolean).join(" · ")}</Text>
              </View>
              {resultado?.notas && <Text style={s.nota}>«{resultado.notas}»</Text>}
              {resultado ? (
                <EjerciciosRevision
                  resultado={resultado}
                  clienteId={sesion.agenda.clienteId}
                  nombreCliente={nombreCliente}
                  api={api}
                  nuevoId={nuevoId}
                />
              ) : sesion.enviadoEn ? (
                <EsqueletoRevision />
              ) : (
                <Text style={s.tenue}>Aún no ha terminado el entrenamiento</Text>
              )}
              {sesion.permiteAjuste && (
                <BotonEnlace
                  texto="Ajustar esta sesión"
                  onPress={() =>
                    router.push({ pathname: "/entrenador/sesion/[id]/ajustar", params: { id } })
                  }
                />
              )}
            </Animated.View>
          ) : (
            !error && <EsqueletoRevision />
          )}
        </ScrollView>
        {resultado && sesion && (
          <View style={s.barraInferior} testID="barra-revision">
            {errorRevision !== "" && <AvisoDeError mensaje={errorRevision} />}
            <View
              style={s.accion}
              onLayout={(evento) => {
                ancho.value = evento.nativeEvent.layout.width
              }}
            >
              <BotonPrincipal
                texto={sesion.revisadaEn ? "Revisada" : "Marcar como revisado"}
                ocupado={revisando}
                deshabilitado={Boolean(sesion.revisadaEn)}
                sinMargen
                onPress={() => void revisar()}
              />
              <Animated.View
                pointerEvents="none"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                style={[s.destello, destello.estilo]}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function EsqueletoRevision(): React.JSX.Element {
  return (
    <View
      style={s.sesion}
      accessibilityLabel="Cargando revisión"
      accessibilityState={{ busy: true }}
    >
      <GrupoEsqueletos>
        <Esqueleto ancho="70%" alto={38} />
        {[0, 1, 2].map((n) => (
          <View key={n} style={s.bloqueEsqueleto}>
            <Esqueleto ancho="55%" alto={24} />
            {[0, 1, 2].map((serie) => (
              <Esqueleto key={serie} alto={44} />
            ))}
          </View>
        ))}
      </GrupoEsqueletos>
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: { flex: 1 },
  barraSuperior: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[8],
    paddingHorizontal: espacio[20],
  },
  volver: { width: 44, height: 44, justifyContent: "center", alignItems: "flex-start" },
  contenido: {
    padding: espacio[20],
    paddingTop: espacio[12],
    gap: espacio[24],
    maxWidth: 820,
    width: "100%",
    alignSelf: "center",
  },
  sesion: { gap: espacio[24] },
  cabecera: { gap: espacio[8] },
  titulo: { ...tipo.tituloPantalla, color: tema.texto },
  tenue: { ...tipo.secundario, ...tipo.cifras },
  nota: { ...tipo.cuerpo, color: tema.textoSecundario },
  insignia: {
    ...tipo.micro,
    alignSelf: "flex-start",
    paddingVertical: espacio[4],
    paddingHorizontal: espacio[8],
    borderRadius: 8,
  },
  revisada: { backgroundColor: tema.exitoSuave, color: tema.exito },
  sinRevisar: { backgroundColor: tema.acentoSuave, color: tema.acento },
  barraInferior: {
    backgroundColor: tema.fondo,
    borderTopWidth: 1,
    borderTopColor: tema.borde,
    padding: espacio[20],
    paddingTop: espacio[12],
    gap: espacio[8],
  },
  accion: { overflow: "hidden" },
  destello: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 34,
    backgroundColor: tema.acentoClaro,
  },
  bloqueEsqueleto: { marginTop: espacio[24], gap: espacio[8] },
})
