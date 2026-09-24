import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { useFocusEffect } from "expo-router"
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video"
import { EjercicioSchema, type Figura } from "@alpha-omega/shared"

import { BotonSecundario } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { direccionDeLaApi } from "../lib/direccion-api"
import { useSesion } from "../sesion"
import { tema } from "../tema"

/**
 * Lo que necesita la figura para pedir su archivo: la API, el token vigente y
 * una forma de renovarlo. El vídeo no pasa por `pedir` (no es JSON), así que un
 * token caducado se arregla pidiendo antes algo que sí pasa por la sesión.
 */
export type AccesoAFiguras = {
  base: string
  token: string | null
  renovar: (ejercicioId: string) => Promise<void>
}

export function useAccesoAFiguras(): AccesoAFiguras {
  const { estado, pedir } = useSesion()
  const token = estado.fase === "dentro" ? estado.tokenAcceso : null
  const renovar = useCallback(
    async (ejercicioId: string) => {
      await pedir(`/ejercicios/${encodeURIComponent(ejercicioId)}`, EjercicioSchema)
    },
    [pedir],
  )
  return useMemo(() => ({ base: direccionDeLaApi(), token, renovar }), [token, renovar])
}

/**
 * La versión va en la dirección: si el entrenador cambia de figura o se sustituye
 * el archivo, la caché del móvil no puede servir el clip anterior.
 */
export function rutaDeFigura(ejercicioId: string, figura: Figura): string {
  const version = encodeURIComponent(`${figura.medioId}.${figura.version}`)
  return `/ejercicios/${encodeURIComponent(ejercicioId)}/figura?v=${version}`
}

/**
 * En Android e iOS el reproductor manda la cabecera y guarda caché solo si la
 * licencia lo permite. Esa caché la puede vaciar el sistema: no es una descarga
 * garantizada. https://docs.expo.dev/versions/v57.0.0/sdk/video/
 */
export function fuenteNativa(url: string, token: string, sinConexion: boolean): VideoSource {
  return { uri: url, headers: { Authorization: `Bearer ${token}` }, useCaching: sinConexion }
}

type Fuente =
  { fase: "cargando" } | { fase: "lista"; fuente: VideoSource; clave: string } | { fase: "error" }

/**
 * En web `headers` no existe: se descarga con `fetch` y se reproduce un blob. Un
 * 401 renueva una vez y repite; si vuelve a fallar, se enseña el error.
 */
function useFuente(
  acceso: AccesoAFiguras,
  ejercicioId: string,
  figura: Figura,
  intento: number,
): Fuente {
  const web = Platform.OS === "web"
  const url = acceso.base + rutaDeFigura(ejercicioId, figura)
  const { token, renovar } = acceso
  const [descarga, setDescarga] = useState<Fuente>({ fase: "cargando" })
  const [repeticion, setRepeticion] = useState(0)
  const renovado = useRef(false)

  useEffect(() => {
    renovado.current = false
  }, [url, intento])

  useEffect(() => {
    if (!web) return
    if (token === null) {
      setDescarga({ fase: "error" })
      return
    }
    const controlador = new AbortController()
    let objeto: string | null = null
    setDescarga({ fase: "cargando" })
    void (async () => {
      try {
        const respuesta = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controlador.signal,
        })
        if (respuesta.status === 401 && !renovado.current) {
          renovado.current = true
          await renovar(ejercicioId)
          if (!controlador.signal.aborted) setRepeticion((n) => n + 1)
          return
        }
        if (!respuesta.ok) throw new Error(`La figura respondió ${String(respuesta.status)}`)
        const archivo = await respuesta.blob()
        if (controlador.signal.aborted) return
        objeto = URL.createObjectURL(archivo)
        setDescarga({ fase: "lista", fuente: { uri: objeto }, clave: objeto })
      } catch {
        if (!controlador.signal.aborted) setDescarga({ fase: "error" })
      }
    })()
    return () => {
      controlador.abort()
      if (objeto !== null) URL.revokeObjectURL(objeto)
    }
  }, [web, url, token, renovar, ejercicioId, intento, repeticion])

  if (web) return descarga
  if (token === null) return { fase: "error" }
  return {
    fase: "lista",
    fuente: fuenteNativa(url, token, figura.sinConexion),
    clave: `${url}#${String(intento)}`,
  }
}

/**
 * La animación de la técnica de un ejercicio: en bucle, sin sonido y con pausa.
 *
 * Carga, error y reintento viven aquí para que la ficha del entrenador y el
 * registro del cliente digan lo mismo. Un fallo del medio nunca bloquea nada más:
 * quien la usa sigue pintando el texto y sus botones.
 */
export function FiguraDeEjercicio({
  acceso,
  ejercicioId,
  figura,
  nombre,
  alto,
}: {
  acceso: AccesoAFiguras
  ejercicioId: string
  figura: Figura
  nombre: string
  /** Alto fijo en lugar del lienzo cuadrado: la tarjeta «Hoy toca» usa 184. */
  alto?: number
}): React.JSX.Element {
  const [intento, setIntento] = useState(0)
  const tamano =
    alto === undefined ? null : { height: alto, aspectRatio: undefined, maxWidth: undefined }
  const [fallo, setFallo] = useState(false)
  const [reintentando, setReintentando] = useState(false)
  const fuente = useFuente(acceso, ejercicioId, figura, intento)
  const alFallar = useCallback(() => {
    setFallo(true)
  }, [])

  async function reintentar(): Promise<void> {
    setReintentando(true)
    try {
      // Si el token había caducado, esto lo renueva antes de volver a pedir el vídeo.
      await acceso.renovar(ejercicioId)
    } catch {
      // Sin red la renovación falla; el reintento puede tirar de la caché.
    } finally {
      setReintentando(false)
      setFallo(false)
      setIntento((n) => n + 1)
    }
  }

  if (fallo || fuente.fase === "error") {
    return (
      <View style={estilos.aviso} accessibilityLiveRegion="polite">
        <Text style={estilos.textoAviso}>
          No se ha podido cargar la animación.{" "}
          {figura.sinConexion
            ? "Revisa la conexión y vuelve a intentarlo."
            : "Esta animación solo se ve con conexión."}
        </Text>
        <BotonSecundario
          texto="Reintentar"
          ocupado={reintentando}
          onPress={() => void reintentar()}
        />
      </View>
    )
  }

  if (fuente.fase === "cargando") {
    return (
      <View style={[estilos.lienzo, tamano, estilos.centro]}>
        <ActivityIndicator color={tema.acento} accessibilityLabel="Cargando la animación" />
      </View>
    )
  }

  return (
    <Reproductor
      key={fuente.clave}
      fuente={fuente.fuente}
      nombre={nombre}
      alFallar={alFallar}
      alto={alto}
    />
  )
}

function Reproductor({
  fuente,
  nombre,
  alFallar,
  alto,
}: {
  fuente: VideoSource
  nombre: string
  alFallar: () => void
  alto?: number
}): React.JSX.Element {
  const tamano =
    alto === undefined ? null : { height: alto, aspectRatio: undefined, maxWidth: undefined }
  // La fuente se fija al montar: un token renovado no debe reiniciar el clip.
  const [inicial] = useState(fuente)
  const jugador = useVideoPlayer(inicial, (nuevo) => {
    nuevo.loop = true
    nuevo.muted = true
  })
  const [lista, setLista] = useState(jugador.status === "readyToPlay")
  const [pausadaPorPersona, setPausadaPorPersona] = useState(false)
  const pausada = useRef(false)
  pausada.current = pausadaPorPersona

  useEffect(() => {
    if (jugador.status === "error") alFallar()
    const suscripcion = jugador.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") setLista(true)
      if (status === "error") alFallar()
    })
    return () => {
      suscripcion.remove()
    }
  }, [jugador, alFallar])

  // Quien pide menos movimiento la ve parada hasta que pulse reanudar.
  useEffect(() => {
    let vigente = true
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reducir) => {
        if (!vigente || !reducir) return
        jugador.pause()
        setPausadaPorPersona(true)
      })
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [jugador])

  // Salir de la pantalla la para; volver la reanuda si nadie la había pausado.
  useFocusEffect(
    useCallback(() => {
      if (!pausada.current) jugador.play()
      return () => {
        jugador.pause()
      }
    }, [jugador]),
  )

  function alternar(): void {
    if (pausadaPorPersona) jugador.play()
    else jugador.pause()
    setPausadaPorPersona(!pausadaPorPersona)
  }

  return (
    <View style={[estilos.marco, alto !== undefined && estilos.marcoCompleto]}>
      <View
        style={[estilos.lienzo, tamano, alto !== undefined && estilos.lienzoCompleto]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Animación de la técnica: ${nombre}`}
      >
        <VideoView
          player={jugador}
          nativeControls={false}
          contentFit="contain"
          style={estilos.video}
        />
        {!lista && (
          <View style={[StyleSheet.absoluteFill, estilos.centro]}>
            <ActivityIndicator color={tema.acento} />
          </View>
        )}
      </View>
      <Pressable
        onPress={alternar}
        accessibilityRole="button"
        accessibilityLabel={pausadaPorPersona ? "Reanudar la animación" : "Pausar la animación"}
        style={estilos.pausa}
        hitSlop={6}
      >
        <Icono nombre={pausadaPorPersona ? "reproducir" : "pausa"} color={tema.texto} tamano={20} />
      </Pressable>
    </View>
  )
}

const estilos = StyleSheet.create({
  // El botón de pausa va encima del clip, arriba a la derecha, como en el diseño.
  marco: { width: "100%", maxWidth: 420, alignSelf: "center" },
  marcoCompleto: { maxWidth: undefined },
  lienzoCompleto: { borderRadius: 14 },
  lienzo: {
    aspectRatio: 1,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: tema.hundido,
  },
  video: { flex: 1 },
  centro: { alignItems: "center", justifyContent: "center" },
  pausa: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: "rgba(14,13,11,.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  aviso: { gap: 8, padding: 16, borderRadius: 20, backgroundColor: tema.superficie },
  textoAviso: {
    color: tema.textoSecundario,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 21,
  },
})
