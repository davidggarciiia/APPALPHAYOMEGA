import { useEffect, useRef, useState } from "react"
import { StyleSheet, Text, TextInput, View } from "react-native"
import { randomUUID } from "expo-crypto"
import type { ComentarioSesion, ComentarSesion } from "@alpha-omega/shared"

import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { faltaDe } from "../lib/errores"
import { ErrorDePermiso, ErrorDelServidor } from "../lib/http"
import { espacio, radio, tema, tipo } from "../tema"

function fecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso))
}

/** Cada destino conserva su propia operación hasta saber si el servidor la aceptó. */
export function ComentariosRevision({
  sesionId,
  ejercicioId = null,
  nombre,
  comentarios,
  abierto = true,
  api,
  publicado,
  nuevoId = randomUUID,
}: {
  sesionId: string
  ejercicioId?: string | null
  nombre: string
  comentarios: ComentarioSesion[]
  abierto?: boolean
  api: ApiEntrenamiento
  publicado: (comentario: ComentarioSesion) => void
  nuevoId?: () => string
}): React.JSX.Element {
  const [texto, setTexto] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [incierto, setIncierto] = useState(false)
  const solicitud = useRef<ComentarSesion | null>(null)
  const enCurso = useRef(false)
  const vigente = useRef(true)
  useEffect(() => {
    vigente.current = true
    return () => {
      vigente.current = false
    }
  }, [])
  const destino = ejercicioId ? `sobre ${nombre}` : "general"
  const etiqueta = ejercicioId ? `Comentario sobre ${nombre}` : `Comentario para ${nombre}`
  const enviar = async (): Promise<void> => {
    if (enCurso.current) return
    if (!solicitud.current && !texto.trim()) return setError("Escribe el comentario.")
    solicitud.current ??= {
      operacionId: nuevoId(),
      ejercicioPrescritoId: ejercicioId,
      texto: texto.trim(),
    }
    enCurso.current = true
    setOcupado(true)
    setError("")
    try {
      const nuevo = await api.comentar(sesionId, solicitud.current)
      solicitud.current = null
      if (!vigente.current) return
      publicado(nuevo)
      setTexto("")
      setIncierto(false)
    } catch (e) {
      if (
        e instanceof ErrorDePermiso ||
        (e instanceof ErrorDelServidor && e.codigo >= 400 && e.codigo < 500 && e.codigo !== 401)
      )
        solicitud.current = null
      if (vigente.current) {
        setIncierto(solicitud.current !== null)
        setError(faltaDe(e, "No se pudo enviar el comentario.").texto)
      }
    } finally {
      enCurso.current = false
      if (vigente.current) setOcupado(false)
    }
  }
  return (
    <View testID={`comentarios-${ejercicioId ?? "generales"}`} style={s.grupo}>
      {comentarios
        .filter((c) => c.ejercicioPrescritoId === ejercicioId)
        .map((c) => (
          <View key={c.id} style={s.comentario}>
            <Text style={s.tenue}>
              {c.autor.nombre} · {fecha(c.creadoEn)}
            </Text>
            <Text style={s.texto}>{c.texto}</Text>
          </View>
        ))}
      {abierto && (
        <>
          <TextInput
            accessibilityLabel={etiqueta}
            placeholder={etiqueta}
            placeholderTextColor={tema.marcador}
            value={texto}
            editable={!ocupado && !incierto}
            onChangeText={(valor) => {
              if (!enCurso.current && !solicitud.current) setTexto(valor)
            }}
            multiline
            maxLength={2000}
            style={s.campo}
          />
          {error !== "" && <AvisoDeError mensaje={error} />}
          <BotonEnlace
            texto={incierto ? "Reintentar comentario" : "Enviar comentario"}
            etiquetaAccesible={`${incierto ? "Reintentar" : "Enviar"} comentario ${destino}`}
            ocupado={ocupado}
            onPress={() => void enviar()}
          />
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: espacio[8] },
  comentario: {
    padding: espacio[12],
    borderRadius: radio.tarjetaInterna,
    backgroundColor: tema.superficie,
    gap: espacio[4],
  },
  tenue: { ...tipo.secundario },
  texto: { ...tipo.cuerpo, color: tema.texto },
  campo: {
    ...tipo.cuerpo,
    color: tema.texto,
    minHeight: 88,
    textAlignVertical: "top",
    padding: espacio[12],
    borderRadius: radio.campo,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
  },
})
