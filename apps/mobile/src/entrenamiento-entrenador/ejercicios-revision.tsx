import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  ETIQUETA_DE_ZONA,
  type ComentarioSesion,
  type Molestia,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { proximaVez } from "../entrenamiento/sesion/modelo"
import { espacio, tema, tipo } from "../tema"
import { edicionDesdeResultado } from "./ficha-modelo"
import { ComentariosRevision } from "./comentarios-revision"

export function EjerciciosRevision({
  resultado,
  clienteId,
  nombreCliente,
  api,
  nuevoId,
}: {
  resultado: ResultadoEntrenamiento
  clienteId: string
  nombreCliente: string
  api: ApiEntrenamiento
  nuevoId?: () => string
}): React.JSX.Element {
  const [comentarios, setComentarios] = useState<ComentarioSesion[]>([])
  const [molestias, setMolestias] = useState<Molestia[]>([])
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    let vigente = true
    void Promise.allSettled([api.comentarios(resultado.sesionId), api.molestias(clienteId)]).then(
      ([c, m]) => {
        if (!vigente) return
        if (c.status === "fulfilled")
          setComentarios((anteriores) => {
            const lista = new Map(
              c.value.comentarios.map((comentario) => [comentario.id, comentario]),
            )
            anteriores.forEach((comentario) => lista.set(comentario.id, comentario))
            return [...lista.values()]
          })
        if (m.status === "fulfilled")
          setMolestias(
            m.value.molestias.filter((molestia) => molestia.sesionId === resultado.sesionId),
          )
        setError(
          c.status === "rejected" || m.status === "rejected"
            ? "No se pudieron cargar los comentarios o las molestias."
            : "",
        )
      },
    )
    return () => {
      vigente = false
    }
  }, [api, resultado.sesionId, clienteId, intento])
  const abiertas = new Set(
    molestias
      .filter((m) => m.estado === "abierta" && m.ejercicioPrescritoId)
      .map((m) => m.ejercicioPrescritoId!),
  )
  const proximas = new Map(
    proximaVez(resultado.prescripcion, edicionDesdeResultado(resultado), abiertas).map((p) => [
      p.ejercicioId,
      p,
    ]),
  )
  const publicado = (nuevo: ComentarioSesion): void =>
    setComentarios((lista) => [...lista.filter((c) => c.id !== nuevo.id), nuevo])
  const comentariosDe = (ejercicioId?: string, nombre = nombreCliente): React.JSX.Element => (
    <ComentariosRevision
      sesionId={resultado.sesionId}
      ejercicioId={ejercicioId}
      nombre={nombre}
      comentarios={comentarios}
      abierto={!ejercicioId || abiertos.has(ejercicioId)}
      api={api}
      publicado={publicado}
      nuevoId={nuevoId}
    />
  )
  return (
    <View style={s.contenido}>
      {error !== "" && (
        <View>
          <AvisoDeError mensaje={error} />
          <BotonEnlace
            texto="Reintentar"
            etiquetaAccesible="Reintentar comentarios y molestias"
            onPress={() => setIntento((n) => n + 1)}
          />
        </View>
      )}
      <PrescripcionVisible
        prescripcion={resultado.prescripcion}
        resultado={resultado}
        revision={{
          cabecera: (e) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Comentar ${e.nombre}`}
              accessibilityState={{ expanded: abiertos.has(e.id) }}
              onPress={() => setAbiertos((previos) => new Set([...previos, e.id]))}
              style={s.comentar}
            >
              <Text style={s.enlace}>Comentar</Text>
            </Pressable>
          ),
          pie: (e) => {
            const proxima = proximas.get(e.id)
            return (
              <View style={s.pie}>
                {proxima && (
                  <Text
                    style={[
                      s.proxima,
                      proxima.tipo === "sube" && s.sube,
                      proxima.tipo === "revision" && s.aviso,
                    ]}
                  >
                    Próxima vez · {proxima.texto}
                  </Text>
                )}
                {molestias
                  .filter((m) => m.ejercicioPrescritoId === e.id)
                  .map((m) => (
                    <View key={m.id} style={s.molestia}>
                      <Text style={s.aviso}>
                        Molestia · {ETIQUETA_DE_ZONA[m.zona].toLocaleLowerCase("es")}
                        {m.serie !== null ? `, serie ${m.serie}` : ""}
                      </Text>
                      {m.estado === "abierta" && <Text style={s.aviso}>Pendiente de ti</Text>}
                    </View>
                  ))}
                {comentariosDe(e.id, e.nombre)}
              </View>
            )
          },
        }}
      />
      {comentariosDe()}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[24] },
  comentar: { minWidth: 68, minHeight: 44, justifyContent: "center", alignItems: "flex-end" },
  enlace: { ...tipo.secundario, color: tema.textoSecundario },
  pie: { gap: espacio[8] },
  proxima: { ...tipo.secundario },
  sube: {
    color: tema.acento,
    backgroundColor: tema.acentoSuave,
    padding: espacio[8],
    alignSelf: "flex-start",
  },
  aviso: { ...tipo.secundario, color: tema.aviso },
  molestia: { gap: espacio[4] },
})
