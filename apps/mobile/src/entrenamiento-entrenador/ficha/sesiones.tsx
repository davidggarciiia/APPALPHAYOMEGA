import { useEffect, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native"
import type { ComentarioSesion, ListadoResultados, Molestia } from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../../componentes/formulario"
import { Icono } from "../../componentes/iconos"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { fechaLegible } from "../../entrenamiento/fechas"
import { BotonDorado } from "../../entrenamiento/sesion/controles"
import { faltaDe } from "../../lib/errores"
import { ErrorDePermiso, ErrorDelServidor } from "../../lib/http"
import { tema } from "../../tema"
import { filasDeSesion, resumenDeResultado, type FilaDeSesion } from "../ficha-modelo"

type Resultado = ListadoResultados["resultados"][number]
type SolicitudComentario = Parameters<ApiEntrenamiento["comentar"]>[1]

const COLUMNAS = ["Ejercicio", "Prescrito", "Sugerido", "Hecho (kg × reps)", "RIR", "Próxima vez"]

function colorDeProxima(fila: FilaDeSesion): object {
  if (fila.conMolestia || fila.proxima?.tipo === "revision") return s.revision
  if (fila.proxima?.tipo === "sube") return s.sube
  return s.celdaTexto
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso))
}

/** «Sesiones» de la ficha: cada sesión enviada con su tabla y los comentarios. */
export function SesionesDelCliente({
  sesionInicial,
  resultados,
  molestias,
  api,
  cuentaId,
  nuevoId,
}: {
  sesionInicial?: string
  resultados: Resultado[]
  molestias: Molestia[]
  api: ApiEntrenamiento
  cuentaId: string
  nuevoId: () => string
}): React.JSX.Element {
  const { width } = useWindowDimensions()
  const [seleccionada, setSeleccionada] = useState(() => sesionInicial ?? resultados[0]?.agenda.id)
  const indice = Math.max(
    0,
    resultados.findIndex((r) => r.agenda.id === seleccionada),
  )
  const [comentarios, setComentarios] = useState<ComentarioSesion[]>([])
  const [borradores, setBorradores] = useState<Record<string, string>>({})
  const [pendientes, setPendientes] = useState<Record<string, SolicitudComentario>>({})
  const solicitudes = useRef<Record<string, SolicitudComentario>>({})
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const enCurso = useRef(false)
  const [revisadas, setRevisadas] = useState<Record<string, boolean>>({})
  const [revisando, setRevisando] = useState<string | null>(null)
  const revisionEnCurso = useRef(false)
  const [errorRevision, setErrorRevision] = useState<{ sesionId: string; texto: string } | null>(
    null,
  )
  const actual = resultados[indice]
  const sesionId = actual?.agenda.id
  const texto = sesionId ? (borradores[sesionId] ?? "") : ""
  const sesionVisible = useRef(sesionId)
  sesionVisible.current = sesionId

  useEffect(() => setSeleccionada(sesionId), [sesionId])

  useEffect(() => {
    if (!sesionId) return
    let vigente = true
    setComentarios([])
    api
      .comentarios(sesionId)
      .then(({ comentarios: lista }) => vigente && setComentarios(lista))
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [api, sesionId])

  if (!actual) return <Text style={s.tenue}>El cliente aún no ha enviado ninguna sesión.</Text>

  const conMolestia = new Set(
    molestias
      .filter((m) => m.sesionId === actual.agenda.id && m.ejercicioPrescritoId !== null)
      .map((m) => m.ejercicioPrescritoId!),
  )
  const filas = filasDeSesion(actual.resultado, conMolestia)
  const ancho = width >= 900
  const revisar = async (): Promise<void> => {
    const origen = actual.agenda.id
    if (revisionEnCurso.current || revisadas[origen]) return
    revisionEnCurso.current = true
    setRevisando(origen)
    setErrorRevision(null)
    try {
      await api.revisar(origen)
      setRevisadas((anteriores) => ({ ...anteriores, [origen]: true }))
    } catch (e) {
      setErrorRevision({
        sesionId: origen,
        texto: faltaDe(e, "No se pudo guardar la revisión. Reintenta.").texto,
      })
    } finally {
      revisionEnCurso.current = false
      setRevisando(null)
    }
  }
  const enviar = async (): Promise<void> => {
    if (enCurso.current) return
    if (texto.trim() === "") return setError("Escribe el comentario.")
    const origen = actual.agenda.id
    const solicitud = solicitudes.current[origen] ?? {
      operacionId: nuevoId(),
      ejercicioPrescritoId: null,
      texto: texto.trim(),
    }
    solicitudes.current[origen] = solicitud
    setPendientes({ ...solicitudes.current })
    const liberar = (): void => {
      delete solicitudes.current[origen]
      setPendientes({ ...solicitudes.current })
    }
    enCurso.current = true
    setError("")
    setEnviando(true)
    try {
      const nuevo = await api.comentar(origen, solicitud)
      liberar()
      setBorradores((anteriores) => ({ ...anteriores, [origen]: "" }))
      if (sesionVisible.current === actual.agenda.id) {
        setComentarios((lista) => [...lista, nuevo])
      }
    } catch (e) {
      if (
        e instanceof ErrorDePermiso ||
        (e instanceof ErrorDelServidor && e.codigo >= 400 && e.codigo < 500 && e.codigo !== 401)
      )
        liberar()
      if (sesionVisible.current === actual.agenda.id)
        setError(faltaDe(e, "No se pudo enviar el comentario.").texto)
    } finally {
      enCurso.current = false
      setEnviando(false)
    }
  }

  return (
    <View style={s.contenido}>
      <View style={s.tarjeta}>
        <View style={s.cabecera}>
          <View style={s.textos}>
            <Text style={s.titulo} accessibilityRole="header">
              {actual.resultado.prescripcion.nombre} · {fechaLegible(actual.agenda.fechaActual)}
            </Text>
            <Text style={s.tenue}>{resumenDeResultado(actual.resultado)}</Text>
            {actual.resultado.notas && <Text style={s.nota}>«{actual.resultado.notas}»</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sesión anterior"
            disabled={enviando || indice >= resultados.length - 1}
            onPress={() => setSeleccionada(resultados[indice + 1]?.agenda.id)}
            style={[s.flecha, (enviando || indice >= resultados.length - 1) && s.apagada]}
          >
            <Icono nombre="atras" color={tema.texto} tamano={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sesión siguiente"
            disabled={enviando || indice === 0}
            onPress={() => setSeleccionada(resultados[indice - 1]?.agenda.id)}
            style={[s.flecha, (enviando || indice === 0) && s.apagada]}
          >
            <Icono nombre="adelante" color={tema.texto} tamano={18} />
          </Pressable>
        </View>

        {ancho ? (
          <View>
            <View style={[s.filaTabla, s.cabeceraTabla]} accessible={false}>
              {COLUMNAS.map((c, n) => (
                <Text key={c} style={[s.celda, n === 0 && s.celdaNombre, s.tenue]}>
                  {c}
                </Text>
              ))}
            </View>
            {filas.map((fila) => (
              <View key={fila.id} style={[s.filaTabla, s.separada]}>
                <Text style={[s.celda, s.celdaNombre, s.fuerte]}>{fila.nombre}</Text>
                <Text style={[s.celda, s.celdaTexto]}>{fila.prescrito}</Text>
                <Text style={[s.celda, s.celdaTexto]}>{fila.sugerido}</Text>
                <Text style={[s.celda, s.fuerte]}>
                  {fila.hecho}
                  {fila.conMolestia && <Text style={s.revision}> (molestia)</Text>}
                </Text>
                <Text style={[s.celda, s.celdaTexto]}>{fila.rir}</Text>
                <Text style={[s.celda, colorDeProxima(fila)]}>
                  {fila.conMolestia ? "Pendiente de ti" : (fila.proxima?.texto ?? "—")}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          filas.map((fila) => (
            <View key={fila.id} style={[s.ejercicio, s.separada]}>
              <Text style={s.fuerte}>{fila.nombre}</Text>
              <Text style={s.tenue}>
                {fila.prescrito} · sugerido {fila.sugerido}
              </Text>
              <Text style={s.celdaTexto}>
                Hecho: {fila.hecho}
                {fila.rir !== "—" ? ` · RIR ${fila.rir}` : ""}
              </Text>
              {(fila.proxima || fila.conMolestia) && (
                <Text style={colorDeProxima(fila)}>
                  Próxima vez: {fila.conMolestia ? "pendiente de ti" : fila.proxima?.texto}
                </Text>
              )}
            </View>
          ))
        )}
      </View>

      {comentarios.map((c) => (
        <View key={c.id} style={s.comentario}>
          <Text style={s.tenue}>
            {c.autor.id === cuentaId ? "Tú" : c.autor.nombre}, {hora(c.creadoEn)}
            {c.ejercicio ? `, sobre el ${c.ejercicio.toLowerCase()}` : ""}
          </Text>
          <Text style={s.texto}>{c.texto}</Text>
        </View>
      ))}

      <View style={s.grupo}>
        <Text style={s.fuerte}>Comentario sobre la sesión</Text>
        <TextInput
          accessibilityLabel="Comentario sobre la sesión"
          value={texto}
          editable={!enviando && !pendientes[actual.agenda.id]}
          onChangeText={(nuevoTexto) => {
            if (!enCurso.current && !solicitudes.current[actual.agenda.id])
              setBorradores((anteriores) => ({ ...anteriores, [actual.agenda.id]: nuevoTexto }))
          }}
          placeholder="Comenta la sesión o una serie…"
          placeholderTextColor={tema.marcador}
          multiline
          maxLength={2000}
          style={s.campo}
        />
        {error !== "" && <AvisoDeError mensaje={error} />}
        {pendientes[actual.agenda.id] && !enviando && (
          <Text style={s.tenue}>Reintenta para confirmar este comentario antes de cambiarlo.</Text>
        )}
        <BotonDorado texto="Enviar comentario" ocupado={enviando} onPress={() => void enviar()} />
        {errorRevision?.sesionId === actual.agenda.id && (
          <AvisoDeError mensaje={errorRevision.texto} />
        )}
        {revisadas[actual.agenda.id] ? (
          <Text style={s.tenue}>Revisada</Text>
        ) : (
          <BotonSecundario
            texto="Marcar como revisada"
            ocupado={revisando === actual.agenda.id}
            deshabilitado={revisando !== null}
            onPress={() => void revisar()}
          />
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 20 },
  grupo: { gap: 10 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 16, gap: 8 },
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 8 },
  textos: { flex: 1, gap: 4 },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13 },
  nota: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 14 },
  texto: { color: tema.texto, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 14 },
  flecha: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: tema.superficieAlta,
    alignItems: "center",
    justifyContent: "center",
  },
  apagada: { opacity: 0.35 },
  filaTabla: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 },
  cabeceraTabla: { paddingTop: 4 },
  separada: { borderTopWidth: 1, borderTopColor: tema.borde },
  celda: { flex: 1, fontSize: 13 },
  celdaNombre: { flex: 1.6 },
  celdaTexto: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 13 },
  sube: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 13 },
  revision: { color: tema.aviso, fontFamily: tema.fuenteBoton, fontSize: 13 },
  ejercicio: { paddingVertical: 10, gap: 3 },
  comentario: {
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: tema.acento,
  },
  campo: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    color: tema.texto,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    padding: 12,
    textAlignVertical: "top",
  },
})
