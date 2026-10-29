import { useCallback, useEffect, useRef, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import type { ListadoResultados, Molestia } from "@alpha-omega/shared"

import { Chip } from "../../componentes/piezas"
import { Pulsable } from "../../componentes/pulsable"
import { BotonEnlace } from "../../componentes/botones"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { fechaLegible } from "../../entrenamiento/fechas"
import { espacio, radio, tema, tipo } from "../../tema"
import { resumenDeResultado } from "../ficha-modelo"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"

type Resultado = ListadoResultados["resultados"][number]["resultado"]
type Revision = { estado: "cargando" | "error" } | { estado: "lista"; fecha: string | null }

function useRevisiones(ids: string[], api: ApiEntrenamiento, sinAcceso: (error: unknown) => void) {
  const [estados, setEstados] = useState<Record<string, Revision>>({})
  const estadosActuales = useRef<Record<string, Revision>>({})
  const idsActuales = useRef(ids)
  idsActuales.current = ids
  const [ocupado, setOcupado] = useState(false)
  const activo = useRef(false)
  const enCurso = useRef(false)
  const pendientes = useRef<string[] | null>(null)
  const consultarActual = useRef<(sesiones: string[]) => Promise<void>>(async () => undefined)
  const version = useRef(0)
  const clave = ids.join("|")
  const consultar = useCallback(
    async (sesiones: string[]) => {
      if (sesiones.length === 0) return
      const cargando: Revision = { estado: "cargando" }
      estadosActuales.current = {
        ...estadosActuales.current,
        ...Object.fromEntries(sesiones.map((id) => [id, cargando])),
      }
      setEstados(estadosActuales.current)
      if (enCurso.current) {
        pendientes.current = [...new Set([...(pendientes.current ?? []), ...sesiones])]
        return
      }
      enCurso.current = true
      setOcupado(true)
      const actual = version.current
      let indice = 0
      const siguiente = async (): Promise<void> => {
        while (indice < sesiones.length && activo.current && actual === version.current) {
          const id = sesiones[indice++]!
          try {
            const sesion = await api.leerEntrenador(id)
            if (activo.current && actual === version.current) {
              estadosActuales.current = {
                ...estadosActuales.current,
                [id]:
                  sesion.revisadaEn === undefined
                    ? { estado: "error" }
                    : { estado: "lista", fecha: sesion.revisadaEn },
              }
              setEstados(estadosActuales.current)
            }
          } catch (error) {
            if (!activo.current || actual !== version.current) return
            if (error instanceof ErrorDePermiso || error instanceof ErrorDeSesion) sinAcceso(error)
            else {
              estadosActuales.current = { ...estadosActuales.current, [id]: { estado: "error" } }
              setEstados(estadosActuales.current)
            }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, sesiones.length) }, siguiente))
      enCurso.current = false
      if (activo.current) {
        const siguienteConsulta = pendientes.current
        pendientes.current = null
        if (siguienteConsulta) await consultarActual.current(siguienteConsulta)
        else setOcupado(false)
      }
    },
    [api, sinAcceso],
  )
  consultarActual.current = consultar
  useFocusEffect(
    useCallback(() => {
      activo.current = true
      void consultar(idsActuales.current)
      return () => {
        activo.current = false
        version.current += 1
        pendientes.current = null
      }
    }, [consultar]),
  )
  useEffect(() => {
    if (activo.current)
      void consultar(idsActuales.current.filter((id) => !(id in estadosActuales.current)))
  }, [clave, consultar])
  return { estados, ocupado, reintentar: (id: string) => void consultar([id]) }
}

function textoRevision(revision?: Revision): string {
  return revision?.estado === "lista"
    ? revision.fecha
      ? "Revisada"
      : "Sin revisar"
    : revision?.estado === "error"
      ? "Revisión no disponible"
      : "Comprobando revisión"
}

function seriesResumen(resultado: Resultado) {
  const hechas = new Map(resultado.series.map((s) => [s.serieId, s]))
  return resultado.prescripcion.ejercicios
    .filter((e) => (e.seccion ?? "principal") === "principal")
    .flatMap((e) =>
      e.series.map((prescrita) => {
        const hecha = hechas.get(prescrita.id)
        const valores = hecha?.hecha ? hecha.valores : null
        const rirBajo = valores?.rir != null && e.rir != null && valores.rir < e.rir.min
        const dosisBaja =
          valores !== null &&
          (valores.tipoMedicion !== prescrita.tipoMedicion ||
            (valores.tipoMedicion === "repeticiones" && prescrita.tipoMedicion === "repeticiones"
              ? valores.repeticiones < prescrita.repeticiones
              : valores.tipoMedicion === "tiempo" && prescrita.tipoMedicion === "tiempo"
                ? valores.segundos < prescrita.segundos
                : valores.tipoMedicion === "distancia" &&
                  prescrita.tipoMedicion === "distancia" &&
                  valores.metros < prescrita.metros))
        return {
          id: prescrita.id,
          estado: !hecha?.hecha
            ? hecha?.omitida
              ? "omitida"
              : "sin hacer"
            : rirBajo || dosisBaja
              ? "fuera de objetivo"
              : "hecha",
          rirBajo,
          cargaSube:
            valores?.pesoKg != null &&
            prescrita.pesoKg != null &&
            valores.pesoKg > prescrita.pesoKg,
        }
      }),
    )
}

export function EtiquetasDeSesion({
  resultado,
  molestias,
  revision,
}: {
  resultado: Resultado
  molestias: Molestia[]
  revision?: Revision
}): React.JSX.Element {
  const series = seriesResumen(resultado)
  const bajas = series.filter((s) => s.rirBajo).length
  const conMolestia = molestias.some(
    (m) => m.sesionId === resultado.sesionId && m.estado === "abierta",
  )
  return (
    <View style={s.etiquetas}>
      <Text
        style={[
          s.insignia,
          revision?.estado === "lista" && revision.fecha ? s.revisada : s.sinRevisar,
        ]}
      >
        {textoRevision(revision)}
      </Text>
      {series.some((s) => s.cargaSube) && <Text style={s.carga}>Cargas que suben</Text>}
      {bajas > 0 && (
        <Text style={s.aviso}>
          {bajas} {bajas === 1 ? "serie con RIR bajo" : "series con RIR bajo"}
        </Text>
      )}
      {conMolestia && <Text style={s.aviso}>Molestia pendiente</Text>}
    </View>
  )
}

/** La revisión y los comentarios se abren en la sesión, desde su tarjeta. */
export function SesionesDelCliente({
  resultados,
  molestias,
  abrir,
  api,
  sinAcceso,
  sinRevisarInicial = false,
}: {
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  abrir: (sesionId: string) => void
  api: ApiEntrenamiento
  sinAcceso: (error: unknown) => void
  sinRevisarInicial?: boolean
}): React.JSX.Element {
  const [sinRevisar, setSinRevisar] = useState(sinRevisarInicial)
  const {
    estados: consultados,
    ocupado,
    reintentar,
  } = useRevisiones(
    resultados.filter((r) => r.revisadaEn === undefined).map((r) => r.agenda.id),
    api,
    sinAcceso,
  )
  const estados: Record<string, Revision> = {
    ...consultados,
    ...Object.fromEntries(
      resultados.flatMap((r) =>
        r.revisadaEn === undefined ? [] : [[r.agenda.id, { estado: "lista", fecha: r.revisadaEn }]],
      ),
    ),
  }
  const visibles = sinRevisar
    ? resultados.filter((r) => {
        const revision = estados[r.agenda.id]
        return revision?.estado !== "lista" || revision.fecha === null
      })
    : resultados
  return (
    <View style={s.contenido}>
      <View style={s.filtros}>
        <Chip texto="Todas" activo={!sinRevisar} onPress={() => setSinRevisar(false)} />
        <Chip texto="Sin revisar" activo={sinRevisar} onPress={() => setSinRevisar(true)} />
      </View>
      {resultados.length === 0 ? (
        <Text style={s.tenue}>El cliente aún no ha enviado ninguna sesión.</Text>
      ) : visibles.length === 0 ? (
        <Text style={s.tenue}>Todas las sesiones están revisadas.</Text>
      ) : (
        <View style={s.contenido}>
          {visibles.map(({ agenda, resultado }) => (
            <Pulsable
              key={agenda.id}
              style={s.tarjeta}
              onPress={() => abrir(agenda.id)}
              accessibilityLabel={`${resultado.prescripcion.nombre} · ${fechaLegible(agenda.fechaActual)}. ${resumenDeResultado(resultado)}. ${textoRevision(estados[agenda.id])}`}
            >
              <Text style={s.titulo}>
                {resultado.prescripcion.nombre} · {fechaLegible(agenda.fechaActual)}
              </Text>
              <Text style={s.tenue}>{resumenDeResultado(resultado)}</Text>
              <EtiquetasDeSesion
                resultado={resultado}
                molestias={molestias}
                revision={estados[agenda.id]}
              />
              <View style={s.series}>
                {seriesResumen(resultado).map((serie, n) => (
                  <View
                    key={serie.id}
                    testID={`serie-resumen-${serie.id}`}
                    accessible
                    accessibilityLabel={`Serie ${n + 1}, ${serie.estado}`}
                    style={[
                      s.serie,
                      serie.estado === "hecha"
                        ? s.hecha
                        : serie.estado === "fuera de objetivo"
                          ? s.fuera
                          : s.omitida,
                    ]}
                  />
                ))}
              </View>
            </Pulsable>
          ))}
          {visibles
            .filter((r) => estados[r.agenda.id]?.estado === "error")
            .map(({ agenda, resultado }) => (
              <BotonEnlace
                key={agenda.id}
                texto={`Reintentar revisión de ${resultado.prescripcion.nombre}`}
                deshabilitado={ocupado}
                onPress={() => reintentar(agenda.id)}
              />
            ))}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[16] },
  filtros: { flexDirection: "row", gap: espacio[8] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[12],
  },
  titulo: { ...tipo.fila, color: tema.texto },
  tenue: tipo.secundario,
  etiquetas: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: espacio[8] },
  insignia: {
    ...tipo.micro,
    borderRadius: radio.celda,
    paddingHorizontal: espacio[8],
    paddingVertical: espacio[4],
  },
  sinRevisar: { color: tema.acento, backgroundColor: tema.acentoSuave },
  revisada: { color: tema.exito, backgroundColor: tema.exitoSuave },
  carga: { ...tipo.secundario, color: tema.acento },
  aviso: { ...tipo.secundario, color: tema.aviso },
  series: { flexDirection: "row", flexWrap: "wrap", gap: espacio[4] },
  serie: { width: 14, height: 14, borderRadius: 4 },
  hecha: { backgroundColor: tema.exito },
  fuera: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: tema.aviso,
    backgroundColor: tema.acentoSuave,
  },
  omitida: { backgroundColor: tema.superficieAlta },
})
