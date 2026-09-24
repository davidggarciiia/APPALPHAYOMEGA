import { useCallback, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import {
  ZONA_AGENDA,
  type AvisoSeguimiento,
  type ListadoAvisosSeguimiento,
} from "@alpha-omega/shared"

import { AvisoDeError, BotonSecundario } from "../componentes/formulario"
import { Icono } from "../componentes/iconos"
import { fechaLegible } from "../entrenamiento/fechas"
import { Fila, Tarjeta, Titulo } from "../entrenamiento/plan/piezas"
import { faltaDe, type Falta } from "../lib/errores"
import { tema } from "../tema"
import type { ApiEvolucionAvisos } from "./valoraciones-api"

type Modo = "cliente" | "entrenador"

/** El servidor manda hasta 50; Inicio los enseña poco a poco, como las novedades. */
const POR_PAGINA = 8

const DIA_DE_AGENDA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_AGENDA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** El día de la agenda en que nació el aviso: a las 00:30 en Madrid ya es el día siguiente. */
function fechaDelAviso(aviso: AvisoSeguimiento): string {
  const partes = DIA_DE_AGENDA.formatToParts(new Date(aviso.creadoEn))
  const parte = (tipo: string): string => partes.find((p) => p.type === tipo)!.value
  return fechaLegible(`${parte("year")}-${parte("month")}-${parte("day")}`)
}

function descripcion(aviso: AvisoSeguimiento, modo: Modo): string {
  const autor = aviso.autor.nombre
  const propia = modo === "cliente"
  switch (aviso.tipo) {
    case "valoracionPublicada":
      return `${autor} publicó ${propia ? "tu" : "una"} valoración`
    case "valoracionCorregida":
      return `${autor} corrigió ${propia ? "tu" : "una"} valoración`
    case "fotosSolicitadas":
      return `${autor} ${propia ? "te pidió" : "pidió"} fotos`
    case "fotosRecibidas":
      return `${autor} envió fotos`
  }
}

/** Por qué un aviso ya no pide nada. Se conserva como historial, sin acción. */
function yaNoVigente(aviso: AvisoSeguimiento): string {
  switch (aviso.tipo) {
    case "valoracionPublicada":
    case "valoracionCorregida":
      return "Sustituida por una corrección"
    case "fotosSolicitadas":
      return "Ya enviadas"
    case "fotosRecibidas":
      return "Ya revisadas"
  }
}

function FilaAviso({
  aviso,
  modo,
  abriendo,
  ocupado,
  pulsar,
}: {
  aviso: AvisoSeguimiento
  modo: Modo
  abriendo: boolean
  ocupado: boolean
  pulsar: () => void
}): React.JSX.Element {
  const texto = descripcion(aviso, modo)
  const fecha = fechaDelAviso(aviso)
  if (!aviso.vigente) {
    const estado = yaNoVigente(aviso)
    return (
      <View
        style={s.aviso}
        accessible
        accessibilityLabel={`${texto}, ${fecha}, ${estado.toLowerCase()}`}
      >
        <View style={s.textos}>
          <Text style={s.historial}>{texto}</Text>
          <Text style={s.tenue}>{fecha}</Text>
          <Text style={s.estado}>{estado}</Text>
        </View>
      </View>
    )
  }
  const nuevo = aviso.leidoEn === null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${texto}, ${fecha}${nuevo ? ", sin leer" : ""}`}
      accessibilityState={{ busy: abriendo, disabled: ocupado }}
      disabled={ocupado}
      onPress={pulsar}
      style={({ pressed }) => [s.aviso, (pressed || abriendo) && s.pulsado]}
    >
      <View style={s.textos}>
        <Text style={s.fuerte}>{texto}</Text>
        <Text style={s.tenue}>{fecha}</Text>
      </View>
      {nuevo && <Text style={s.nueva}>Nueva</Text>}
      <Icono nombre="adelante" color={nuevo ? tema.acento : tema.textoTenue} />
    </Pressable>
  )
}

/**
 * Avisos de valoraciones y fotos, para el cliente en Inicio y para el entrenador
 * en la ficha. Abrir uno guarda solo su lectura: no publica, corrige ni revisa
 * nada. Si la lectura no se guarda, se abre igualmente y el aviso sigue sin leer.
 */
export function AvisosSeguimiento({
  clienteId,
  api,
  modo,
  abrir,
}: {
  clienteId: string
  api: Pick<ApiEvolucionAvisos, "avisos" | "leerAvisos">
  modo: Modo
  abrir: (aviso: AvisoSeguimiento) => void
}): React.JSX.Element | null {
  const [cargados, setCargados] = useState<{
    clienteId: string
    listado: ListadoAvisosSeguimiento
  } | null>(null)
  const [falloCarga, setFalloCarga] = useState<Falta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [intento, setIntento] = useState(0)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [reintentando, setReintentando] = useState(false)
  const [sinGuardar, setSinGuardar] = useState<string[]>([])
  const [falloLectura, setFalloLectura] = useState<Falta | null>(null)
  const [mostrados, setMostrados] = useState(POR_PAGINA)
  // Una consulta que sale antes de guardar una lectura no la pisa al llegar.
  const turno = useRef(0)
  const ocupado = useRef(false)

  useFocusEffect(
    useCallback(() => {
      let vigente = true
      const propio = ++turno.current
      setCargando(true)
      api
        .avisos(clienteId)
        .then((listado) => {
          if (!vigente || propio !== turno.current) return
          setCargados({ clienteId, listado })
          setFalloCarga(null)
        })
        .catch((fallo: unknown) => {
          if (vigente && propio === turno.current)
            setFalloCarga(faltaDe(fallo, "No se pudieron cargar los avisos de seguimiento."))
        })
        .finally(() => {
          if (vigente) setCargando(false)
        })
      return () => {
        vigente = false
      }
    }, [api, clienteId, intento]),
  )

  const listado = cargados?.clienteId === clienteId ? cargados.listado : null
  const avisos = listado?.avisos ?? []
  const pendientes = sinGuardar.filter((id) =>
    avisos.some((a) => a.id === id && a.vigente && a.leidoEn === null),
  )

  const guardarLectura = async (ids: string[]): Promise<boolean> => {
    try {
      const nuevo = await api.leerAvisos(clienteId, ids)
      turno.current += 1
      setCargados({ clienteId, listado: nuevo })
      setFalloCarga(null)
      setSinGuardar((actual) => actual.filter((id) => !ids.includes(id)))
      return true
    } catch (fallo) {
      setSinGuardar((actual) => [...actual, ...ids.filter((id) => !actual.includes(id))])
      setFalloLectura(
        faltaDe(fallo, "No se pudo guardar que has leído el aviso. Puedes reintentarlo."),
      )
      return false
    }
  }

  const pulsar = async (aviso: AvisoSeguimiento): Promise<void> => {
    if (ocupado.current) return
    if (aviso.leidoEn === null) {
      ocupado.current = true
      setAbriendo(aviso.id)
      await guardarLectura([aviso.id])
      ocupado.current = false
      setAbriendo(null)
    }
    abrir(aviso)
  }

  const reintentarLectura = async (): Promise<void> => {
    if (ocupado.current || pendientes.length === 0) return
    ocupado.current = true
    setReintentando(true)
    if (await guardarLectura(pendientes)) setFalloLectura(null)
    ocupado.current = false
    setReintentando(false)
  }

  // Como las novedades de entrenamiento: sin avisos, Inicio no reserva sitio.
  if (falloCarga === null && avisos.length === 0) return null
  const sinLeer = listado?.sinLeer ?? 0
  return (
    <View style={s.grupo}>
      <Titulo derecha={sinLeer > 0 ? `${sinLeer} sin leer` : null}>Avisos de seguimiento</Titulo>
      {falloCarga !== null && (
        <>
          <AvisoDeError mensaje={falloCarga.texto} />
          {falloCarga.reintentable && (
            <BotonSecundario
              texto="Reintentar"
              etiquetaAccesible="Reintentar cargar los avisos de seguimiento"
              ocupado={cargando}
              onPress={() => setIntento((n) => n + 1)}
            />
          )}
        </>
      )}
      {falloLectura !== null && pendientes.length > 0 && (
        <>
          <AvisoDeError mensaje={falloLectura.texto} />
          {falloLectura.reintentable && (
            <BotonSecundario
              texto="Reintentar"
              etiquetaAccesible="Reintentar guardar la lectura de los avisos"
              ocupado={reintentando}
              deshabilitado={abriendo !== null}
              onPress={() => void reintentarLectura()}
            />
          )}
        </>
      )}
      {avisos.length > 0 && (
        <Tarjeta>
          {avisos.slice(0, mostrados).map((aviso, indice) => (
            <Fila key={aviso.id} primera={indice === 0}>
              <FilaAviso
                aviso={aviso}
                modo={modo}
                abriendo={abriendo === aviso.id}
                ocupado={abriendo !== null || reintentando}
                pulsar={() => void pulsar(aviso)}
              />
            </Fila>
          ))}
        </Tarjeta>
      )}
      {avisos.length > mostrados && (
        <BotonSecundario
          texto="Ver más avisos"
          onPress={() => setMostrados((n) => n + POR_PAGINA)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  aviso: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  pulsado: { opacity: 0.8 },
  textos: { flex: 1, gap: 4 },
  fuerte: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 15 },
  historial: { color: tema.textoSecundario, fontFamily: tema.fuenteTexto, fontSize: 15 },
  tenue: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18 },
  estado: { color: tema.textoSecundario, fontFamily: tema.fuenteSemi, fontSize: 13 },
  nueva: { color: tema.acento, fontFamily: tema.fuenteSemi, fontSize: 12 },
})
