import { useEffect, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import type { ComentarioSesion, Molestia } from "@alpha-omega/shared"

import { tema } from "../../tema"
import type { ApiEntrenamiento } from "../api"

/**
 * Lo que dijo el entrenador sobre una sesión enviada: sus comentarios y sus
 * respuestas a las molestias. Sin conexión no se enseña nada.
 */
export function RespuestasDelEntrenador({
  cuenta,
  sesionId,
  api,
}: {
  cuenta: string
  sesionId: string
  api: ApiEntrenamiento
}): React.JSX.Element | null {
  const [comentarios, setComentarios] = useState<ComentarioSesion[]>([])
  const [molestias, setMolestias] = useState<Molestia[]>([])
  useEffect(() => {
    let vigente = true
    api
      .comentarios(sesionId)
      .then(({ comentarios: lista }) => vigente && setComentarios(lista))
      .catch(() => undefined)
    api
      .molestias(cuenta, "atendida")
      .then(
        ({ molestias: lista }) =>
          vigente && setMolestias(lista.filter((m) => m.sesionId === sesionId)),
      )
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [api, cuenta, sesionId])
  const delEntrenador = comentarios.filter((c) => c.autor.rol === "entrenador")
  if (delEntrenador.length === 0 && molestias.length === 0) return null
  return (
    <View style={s.grupo}>
      <Text style={s.titulo} accessibilityRole="header">
        Tu entrenador
      </Text>
      {molestias.map((m) => (
        <View key={m.id} style={s.tarjeta}>
          <Text style={s.tenue}>
            Sobre tu molestia{m.ejercicio ? ` en ${m.ejercicio.toLowerCase()}` : ""}
          </Text>
          <Text style={s.texto}>{m.respuesta}</Text>
        </View>
      ))}
      {delEntrenador.map((c) => (
        <View key={c.id} style={s.tarjeta}>
          {c.ejercicio && <Text style={s.tenue}>Sobre el {c.ejercicio.toLowerCase()}</Text>}
          <Text style={s.texto}>{c.texto}</Text>
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 10 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: tema.acento,
  },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
})
