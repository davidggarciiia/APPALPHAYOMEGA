import { memo, useCallback, type ReactNode } from "react"
import { FlatList, StyleSheet, Text, View } from "react-native"
import type { ListadoResultados, Molestia } from "@alpha-omega/shared"

import { Pulsable } from "../../componentes/pulsable"
import { fechaLegible } from "../../entrenamiento/fechas"
import { espacio, radio, tema, tipo } from "../../tema"
import { resumenDeResultado } from "../ficha-modelo"

type Resultado = ListadoResultados["resultados"][number]["resultado"]
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
}: {
  resultado: Resultado
  molestias: Molestia[]
}): React.JSX.Element {
  const series = seriesResumen(resultado)
  const bajas = series.filter((s) => s.rirBajo).length
  const conMolestia = molestias.some(
    (m) => m.sesionId === resultado.sesionId && m.estado === "abierta",
  )
  return (
    <View style={s.etiquetas}>
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

/** El registro y los comentarios se abren en la sesión, desde su tarjeta. */
export function SesionesDelCliente({
  resultados,
  molestias,
  abrir,
  cabecera,
}: {
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  abrir: (sesionId: string) => void
  cabecera?: ReactNode
}): React.JSX.Element {
  const pintar = useCallback(
    ({ item }: { item: ListadoResultados["resultados"][number] }) => (
      <TarjetaSesion sesion={item} molestias={molestias} abrir={abrir} />
    ),
    [molestias, abrir],
  )
  return (
    <FlatList
      testID="historial-sesiones"
      data={resultados}
      keyExtractor={claveSesion}
      renderItem={pintar}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.contenido}
      ListHeaderComponent={cabecera ? <View style={s.cabecera}>{cabecera}</View> : null}
      ListEmptyComponent={
        <Text style={s.tenue}>El cliente aún no ha enviado ninguna sesión.</Text>
      }
    />
  )
}

const claveSesion = (sesion: ListadoResultados["resultados"][number]) => sesion.agenda.id
const TarjetaSesion = memo(function TarjetaSesion({
  sesion: { agenda, resultado },
  molestias,
  abrir,
}: {
  sesion: ListadoResultados["resultados"][number]
  molestias: Molestia[]
  abrir: (sesionId: string) => void
}): React.JSX.Element {
  return (
    <Pulsable
      style={s.tarjeta}
      onPress={() => abrir(agenda.id)}
      accessibilityLabel={`${resultado.prescripcion.nombre} · ${fechaLegible(agenda.fechaActual)}. ${resumenDeResultado(resultado)}`}
    >
      <Text style={s.titulo}>
        {resultado.prescripcion.nombre} · {fechaLegible(agenda.fechaActual)}
      </Text>
      <Text style={s.tenue}>{resumenDeResultado(resultado)}</Text>
      <EtiquetasDeSesion resultado={resultado} molestias={molestias} />
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
  )
})

const s = StyleSheet.create({
  contenido: { gap: espacio[16] },
  cabecera: { marginBottom: espacio[8] },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    padding: espacio[16],
    gap: espacio[12],
  },
  titulo: { ...tipo.fila, color: tema.texto },
  tenue: tipo.secundario,
  etiquetas: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: espacio[8] },
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
