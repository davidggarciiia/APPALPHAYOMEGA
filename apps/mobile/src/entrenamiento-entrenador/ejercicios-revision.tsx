import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  ETIQUETA_DE_ZONA,
  estadoDeProgresion,
  type ComentarioSesion,
  type ListadoResultados,
  type Molestia,
  type ResultadoEntrenamiento,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonEnlace } from "../componentes/formulario"
import type { ApiEntrenamiento } from "../entrenamiento/api"
import { PrescripcionVisible } from "../entrenamiento/resultado"
import { espacio, tema, tipo } from "../tema"
import { ErrorDePermiso, ErrorDeSesion } from "../lib/http"
import { ComentariosRevision } from "./comentarios-revision"
import { DialogoResponder, textoDeMolestia } from "./ficha/atencion"
import { historialDelEjercicio } from "./ficha/progresion-modelo"
import { EstadoProgresion } from "./ficha/lista-progresion"

export function EjerciciosRevision({
  resultado,
  clienteId,
  nombreCliente,
  api,
  nuevoId,
  sinAcceso,
}: {
  resultado: ResultadoEntrenamiento
  clienteId: string
  nombreCliente: string
  api: ApiEntrenamiento
  nuevoId?: () => string
  sinAcceso: (causa: unknown) => void
}): React.JSX.Element {
  const [comentarios, setComentarios] = useState<ComentarioSesion[]>([])
  const [molestias, setMolestias] = useState<Molestia[]>([])
  const [historial, setHistorial] = useState<ListadoResultados["resultados"]>([])
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set())
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [respondiendo, setRespondiendo] = useState<Molestia | null>(null)
  const versionMolestias = useRef(0)
  const montado = useRef(true)
  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])
  useEffect(() => {
    let vigente = true
    const version = versionMolestias.current
    void Promise.allSettled([
      api.comentarios(resultado.sesionId),
      api.molestias(clienteId),
      api.resultados(clienteId, 60),
    ]).then(([c, m, h]) => {
      if (!vigente) return
      const revocado = [c, m, h].find(
        (lectura) =>
          lectura.status === "rejected" &&
          (lectura.reason instanceof ErrorDePermiso || lectura.reason instanceof ErrorDeSesion),
      )
      if (revocado?.status === "rejected") {
        setComentarios([])
        setMolestias([])
        setHistorial([])
        setRespondiendo(null)
        sinAcceso(revocado.reason)
        return
      }
      if (c.status === "fulfilled")
        setComentarios((anteriores) => {
          const lista = new Map(
            c.value.comentarios.map((comentario) => [comentario.id, comentario]),
          )
          anteriores.forEach((comentario) => lista.set(comentario.id, comentario))
          return [...lista.values()]
        })
      if (m.status === "fulfilled" && version === versionMolestias.current)
        setMolestias(
          m.value.molestias.filter((molestia) => molestia.sesionId === resultado.sesionId),
        )
      if (h.status === "fulfilled") setHistorial(h.value.resultados)
      setError(
        c.status === "rejected" || m.status === "rejected" || h.status === "rejected"
          ? "No se pudieron cargar los comentarios, las molestias o la progresión."
          : "",
      )
    })
    return () => {
      vigente = false
    }
  }, [api, resultado.sesionId, clienteId, intento, sinAcceso])
  const responder = async (molestia: Molestia, texto: string): Promise<void> => {
    try {
      const atendida = await api.atenderMolestia(molestia.id, texto)
      if (!montado.current) return
      versionMolestias.current += 1
      setMolestias((lista) => lista.map((m) => (m.id === atendida.id ? atendida : m)))
    } catch (causa) {
      if (montado.current && (causa instanceof ErrorDePermiso || causa instanceof ErrorDeSesion))
        sinAcceso(causa)
      throw causa
    }
  }
  const resultadosActuales = historial.map((r) =>
    r.resultado.sesionId === resultado.sesionId ? { ...r, resultado } : r,
  )
  const estados = new Map(
    resultado.prescripcion.ejercicios
      .filter((e) => (e.seccion ?? "principal") === "principal")
      .map((e) => {
        const sesiones = historialDelEjercicio(resultadosActuales, e.ejercicioId)
        const actual = sesiones.findIndex((s) => s.sesionId === resultado.sesionId)
        return [e.id, actual < 0 ? null : estadoDeProgresion(sesiones.slice(actual))] as const
      }),
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
  const avisoMolestia = (m: Molestia): React.JSX.Element => (
    <View key={m.id} style={s.molestia}>
      <Text style={s.aviso}>
        Molestia · {ETIQUETA_DE_ZONA[m.zona].toLocaleLowerCase("es")}
        {m.serie != null ? `, serie ${m.serie}` : ""}
      </Text>
      <Text style={s.proxima}>{textoDeMolestia(m).detalle}</Text>
      {m.estado === "abierta" ? (
        <>
          <Text style={s.aviso}>Pendiente de ti</Text>
          <BotonEnlace
            texto="Responder"
            etiquetaAccesible={`Responder: ${textoDeMolestia(m).titulo}`}
            onPress={() => setRespondiendo(m)}
          />
        </>
      ) : (
        <Text style={s.proxima}>Tu respuesta: {m.respuesta}</Text>
      )}
    </View>
  )
  const ejercicios = new Set(resultado.prescripcion.ejercicios.map((e) => e.id))
  const generales = molestias.filter(
    (m) => !m.ejercicioPrescritoId || !ejercicios.has(m.ejercicioPrescritoId),
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
            return (
              <View style={s.pie}>
                <EstadoProgresion estado={estados.get(e.id) ?? null} />
                {molestias.filter((m) => m.ejercicioPrescritoId === e.id).map(avisoMolestia)}
                {comentariosDe(e.id, e.nombre)}
              </View>
            )
          },
        }}
      />
      {generales.map(avisoMolestia)}
      {comentariosDe()}
      <DialogoResponder
        molestia={respondiendo}
        cerrar={() => setRespondiendo(null)}
        responder={responder}
      />
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[24] },
  comentar: { minWidth: 68, minHeight: 44, justifyContent: "center", alignItems: "flex-end" },
  enlace: { ...tipo.secundario, color: tema.textoSecundario },
  pie: { gap: espacio[8] },
  proxima: { ...tipo.secundario },
  aviso: { ...tipo.secundario, color: tema.aviso },
  molestia: { gap: espacio[4] },
})
