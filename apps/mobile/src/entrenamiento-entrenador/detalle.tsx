import { useCallback, useRef, useState } from "react"
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
import type { SesionEntrenador, ResultadoEntrenamiento } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"
import { Icono } from "../componentes/iconos"
import { espacio, tema, tipo } from "../tema"
import { faltaDe } from "../lib/errores"
import { ErrorDePermiso, ErrorDeSesion } from "../lib/http"
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
  const [intento, setIntento] = useState(0)
  const accesoRevocado = useRef(false)
  const retirarAcceso = useCallback((causa: unknown): void => {
    accesoRevocado.current = true
    setSesion(null)
    setResultado(undefined)
    setError(faltaDe(causa, "No se pudo actualizar el entrenamiento.").texto)
  }, [])
  const router = useRouter()
  const completada = Boolean(sesion?.enviadoEn && resultado && !error)
  useFocusEffect(
    useCallback(() => {
      if (completada || accesoRevocado.current) return
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
            const sinAcceso = [s, r].find(
              (consulta) =>
                consulta.status === "rejected" &&
                (consulta.reason instanceof ErrorDePermiso ||
                  consulta.reason instanceof ErrorDeSesion),
            )
            if (sinAcceso?.status === "rejected") {
              retirarAcceso(sinAcceso.reason)
              return
            }
            if (s.status === "fulfilled" && r.status === "fulfilled") accesoRevocado.current = false
            if (accesoRevocado.current) return
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
        } catch (causa) {
          if (!vigente) return
          if (causa instanceof ErrorDePermiso || causa instanceof ErrorDeSesion)
            retirarAcceso(causa)
          else setError("No se pudo actualizar el entrenamiento.")
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
    }, [id, api, intento, completada, retirarAcceso]),
  )
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
              <BotonEnlace
                texto="Reintentar"
                onPress={() => {
                  accesoRevocado.current = false
                  setIntento((n) => n + 1)
                }}
              />
            </View>
          )}
          {sesion ? (
            <View style={s.sesion}>
              <View style={s.cabecera}>
                <Text style={s.titulo} accessibilityRole="header">
                  {sesion.prescripcion.nombre}
                </Text>
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
                  sinAcceso={retirarAcceso}
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
            </View>
          ) : (
            !error && <EsqueletoRevision />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function EsqueletoRevision(): React.JSX.Element {
  return (
    <View style={s.sesion} accessibilityLabel="Cargando sesión" accessibilityState={{ busy: true }}>
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
  bloqueEsqueleto: { marginTop: espacio[24], gap: espacio[8] },
})
