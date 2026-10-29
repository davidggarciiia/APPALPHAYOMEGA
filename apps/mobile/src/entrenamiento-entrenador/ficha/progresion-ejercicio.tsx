import { useCallback, useMemo, useState } from "react"
import { useFocusEffect } from "expo-router"
import { StyleSheet, Text, View, useWindowDimensions } from "react-native"
import {
  compararSemanas,
  estadoDeProgresion,
  type FichaDeUsuario,
  type ListadoResultados,
  type ProgresionFuerza,
} from "@alpha-omega/shared"
import { AvisoDeError, BotonSecundario } from "../../componentes/formulario"
import { EntradaMarca } from "../../componentes/entrada-marca"
import { Esqueleto, GrupoEsqueletos } from "../../componentes/esqueleto"
import { Pulsable } from "../../componentes/pulsable"
import type { ApiEntrenamiento } from "../../entrenamiento/api"
import { fechaLegible } from "../../entrenamiento/fechas"
import { BotonAtras, Enlace } from "../../entrenamiento/sesion/controles"
import { ErrorDePermiso, ErrorDeSesion } from "../../lib/http"
import type { ApiSeguimiento } from "../../seguimiento/api"
import { Grafica } from "../../seguimiento/grafica"
import { alto, radio, tema, tipo } from "../../tema"
import { DeltaProgresion, EstadoProgresion } from "./lista-progresion"
import {
  conRirDelHistorial,
  decimal,
  historialDelEjercicio,
  pautaDelEjercicio,
  serieLegible,
  semanasDeFuerza,
  type SesionDelEjercicio,
} from "./progresion-modelo"

type Propiedades = {
  clienteId: string
  ejercicioId: string
  api: Pick<ApiEntrenamiento, "resultados">
  seguimiento: Pick<ApiSeguimiento, "fuerza">
  leerFicha: () => Promise<FichaDeUsuario>
  volver: () => void
  ajustar: (ejercicioId: string) => void
  abrirSesion: (sesionId: string, nombre: string) => void
}
type Datos = {
  ficha: FichaDeUsuario
  fuerza: ProgresionFuerza
  resultados: ListadoResultados["resultados"]
}

export function ProgresionEjercicio(props: Propiedades): React.JSX.Element {
  return <ProgresionActual key={`${props.clienteId}:${props.ejercicioId}`} {...props} />
}

function ProgresionActual({
  clienteId,
  ejercicioId,
  api,
  seguimiento,
  leerFicha,
  volver,
  ajustar,
  abrirSesion,
}: Propiedades): React.JSX.Element {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [intento, setIntento] = useState(0)
  const [limite, setLimite] = useState(4)
  useFocusEffect(
    useCallback(() => {
      let vigente = true
      setError("")
      Promise.all([leerFicha(), seguimiento.fuerza(clienteId), api.resultados(clienteId, 60)])
        .then(([ficha, fuerza, { resultados }]) => {
          if (vigente) setDatos({ ficha, fuerza, resultados })
        })
        .catch((causa: unknown) => {
          if (!vigente) return
          if (causa instanceof ErrorDePermiso || causa instanceof ErrorDeSesion) setDatos(null)
          setError("No se pudo cargar la progresión del ejercicio.")
        })
      return () => {
        vigente = false
      }
    }, [clienteId, api, seguimiento, leerFicha, intento]),
  )
  const historial = useMemo(
    () => historialDelEjercicio(datos?.resultados ?? [], ejercicioId),
    [datos, ejercicioId],
  )
  const fuerza = datos?.fuerza.ejercicios.find((e) => e.ejercicioId === ejercicioId)
  const semanas = useMemo(
    () => semanasDeFuerza(fuerza?.puntos ?? [], historial),
    [fuerza, historial],
  )
  const ultima = semanas.at(-1)
  const anterior = semanas.at(-2)
  const comparacion = compararSemanas(ultima?.serie ?? null, anterior?.serie ?? null)
  const ejercicio = historial[0]?.ejercicio
  const nombre = datos ? [datos.ficha.nombre, datos.ficha.apellidos].filter(Boolean).join(" ") : ""
  const doble =
    ejercicio &&
    ejercicio.tipoCarga !== "sinCarga" &&
    !ejercicio.calibrar &&
    ejercicio.rir &&
    ejercicio.series.every((s) => s.tipoMedicion === "repeticiones")
  const tope = ejercicio?.series.map((s) =>
    s.tipoMedicion === "repeticiones" ? (s.repeticionesMax ?? s.repeticiones) : null,
  )
  const mismoTope = tope?.length && new Set(tope).size === 1
  return (
    <View style={s.contenido}>
      <View style={s.barra}>
        <BotonAtras etiqueta="Volver a la ficha" onPress={volver} />
        <Text style={s.tenue}>{nombre}</Text>
      </View>
      {error !== "" && (
        <View style={s.grupo}>
          <AvisoDeError mensaje={error} />
          <BotonSecundario texto="Reintentar" onPress={() => setIntento((n) => n + 1)} />
        </View>
      )}
      {!datos ? (
        error === "" && (
          <View
            accessible
            accessibilityLabel="Cargando progresión del ejercicio"
            accessibilityState={{ busy: true }}
          >
            <GrupoEsqueletos>
              <Esqueleto ancho="75%" alto={38} />
              <Esqueleto alto={260} />
              <Esqueleto alto={156} />
            </GrupoEsqueletos>
          </View>
        )
      ) : (
        <EntradaMarca style={s.contenido}>
          <Text style={s.titulo} accessibilityRole="header">
            {(fuerza?.nombre ?? ejercicio?.nombre ?? "Ejercicio").toLocaleUpperCase("es")}
          </Text>
          <View style={s.insignias}>
            <EstadoProgresion estado={estadoDeProgresion(historial)} />
            {doble && <Text style={s.insignia}>Doble progresión</Text>}
          </View>
          {doble && mismoTope ? (
            <Text style={s.tenue}>
              El cliente sube carga al llegar a {tope[0]} reps en todas las series con RIR{" "}
              {ejercicio.rir?.min}.
            </Text>
          ) : null}
          {ultima && (
            <View style={s.hero}>
              <Text style={s.micro}>Mejor serie · {fechaLegible(ultima.fecha)}</Text>
              <View style={s.resumen}>
                <Text style={s.mejor}>
                  {decimal(ultima.serie.pesoKg!)} kg × {ultima.serie.repeticiones}
                </Text>
                <DeltaProgresion comparacion={comparacion} />
              </View>
              <Grafica
                puntos={semanas.map((p) => ({ fecha: p.semana, valor: p.serie.pesoKg! }))}
                tendencia={[]}
                comparacion={semanas.map((p) => ({ fecha: p.semana, valor: p.estimado }))}
                descripcion={`${fuerza?.nombre}: mejor serie semanal y 1RM estimado en kg. ${semanas.map((p) => `${p.semana}: ${decimal(p.serie.pesoKg!)} kg; 1RM ${decimal(p.estimado)} kg`).join(". ")}`}
                izquierda={semanas[0]!.semana}
                derecha={ultima.semana}
                animar
              />
              {semanas.length > 1 && (
                <View style={s.leyenda}>
                  <Text style={s.oro}>━ Mejor serie · kg</Text>
                  <Text style={s.tenue}>┄ 1RM estimado · kg</Text>
                </View>
              )}
            </View>
          )}
          {(ejercicio || ultima) && (
            <View style={s.tarjeta}>
              {ejercicio && (
                <View style={s.fila}>
                  <View style={s.flex}>
                    <Text style={s.tenue}>Pedido</Text>
                    <Text style={s.texto}>{pautaDelEjercicio(ejercicio)}</Text>
                  </View>
                  {error === "" && (
                    <Enlace
                      texto="Ajustar"
                      etiqueta="Ajustar RIR pedido"
                      onPress={() => ajustar(ejercicioId)}
                    />
                  )}
                </View>
              )}
              {ultima && (
                <View style={s.fila}>
                  <View style={s.flex}>
                    <Text style={s.tenue}>1RM estimado</Text>
                    <Text style={s.texto}>{ultima.estimado.toFixed(1).replace(".", ",")} kg</Text>
                  </View>
                  <DeltaProgresion comparacion={comparacion} estimado />
                </View>
              )}
              <View style={s.fila}>
                <Text style={s.tenue}>Semana anterior</Text>
                <Text style={s.texto}>
                  {anterior
                    ? `${serieLegible(anterior.serie)} · RIR ${conRirDelHistorial(anterior, historial)?.rir ?? "—"}`
                    : "Sin semana anterior"}
                </Text>
              </View>
            </View>
          )}
          <View style={s.grupo}>
            {historial.length > 0 ? (
              <>
                <Text style={s.micro}>Últimas sesiones</Text>
                {historial.slice(0, limite).map((sesion) => (
                  <SesionProgresion
                    key={sesion.sesionId}
                    sesion={sesion}
                    abrir={() => abrirSesion(sesion.sesionId, nombre)}
                  />
                ))}
                {limite < historial.length && (
                  <Enlace
                    texto="Ver más"
                    etiqueta="Ver más sesiones"
                    onPress={() => setLimite((n) => n + 10)}
                  />
                )}
              </>
            ) : (
              <Text style={s.tenue}>Aún sin sesiones de este ejercicio.</Text>
            )}
          </View>
        </EntradaMarca>
      )}
    </View>
  )
}

function SesionProgresion({
  sesion,
  abrir,
}: {
  sesion: SesionDelEjercicio
  abrir: () => void
}): React.JSX.Element {
  const { fontScale } = useWindowDimensions()
  return (
    <Pulsable
      testID="sesion-progresion"
      style={s.sesion}
      accessibilityLabel={`${fechaLegible(sesion.fecha)}, ${pautaDelEjercicio(sesion.ejercicio)}. ${sesion.series.map((s, i) => `Serie ${i + 1}, ${serieLegible(s)}${s.hecha ? `, RIR ${s.rir ?? "sin registrar"}` : ""}`).join(". ")}. Abrir revisión`}
      onPress={abrir}
    >
      <View style={s.cabeceraSesion}>
        <Text style={s.texto}>{fechaLegible(sesion.fecha)}</Text>
        <Text style={s.tenue}>{pautaDelEjercicio(sesion.ejercicio)}</Text>
      </View>
      <View style={s.series}>
        {sesion.series.map((serie, i) => (
          <View
            key={serie.serieId}
            style={[
              s.serie,
              !serie.hecha && { opacity: 0.5 },
              {
                flexBasis:
                  fontScale > 1.3 ? "45%" : `${100 / Math.min(sesion.series.length, 4) - 3}%`,
              },
            ]}
            accessible
            accessibilityLabel={`Serie ${i + 1}, ${serieLegible(serie)}${serie.hecha ? `, RIR ${serie.rir ?? "sin registrar"}` : ""}`}
          >
            <Text style={[s.valor, !serie.hecha && s.tenue]}>{serieLegible(serie)}</Text>
            {serie.hecha && (
              <Text
                style={[
                  s.tenue,
                  serie.rir != null &&
                  sesion.rirPorSerie[serie.serieId] &&
                  serie.rir < sesion.rirPorSerie[serie.serieId]!.min
                    ? s.aviso
                    : null,
                ]}
              >
                RIR {serie.rir ?? "—"}
              </Text>
            )}
          </View>
        ))}
      </View>
    </Pulsable>
  )
}

const s = StyleSheet.create({
  contenido: { gap: 24 },
  grupo: { gap: 12 },
  barra: { minHeight: alto.barraSuperior, flexDirection: "row", alignItems: "center", gap: 12 },
  titulo: { ...tipo.tituloPantalla, color: tema.texto },
  tenue: tipo.secundario,
  texto: { ...tipo.cuerpo, color: tema.texto, ...tipo.cifras },
  micro: { ...tipo.micro, color: tema.textoTenue },
  insignias: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  insignia: {
    ...tipo.secundario,
    backgroundColor: tema.superficieAlta,
    padding: 8,
    borderRadius: radio.celda,
  },
  hero: {
    backgroundColor: tema.superficie,
    borderRadius: radio.tarjeta,
    borderWidth: 1,
    borderColor: tema.bordeDestacado,
    padding: 16,
    gap: 16,
  },
  resumen: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  mejor: { ...tipo.heroCompacto, fontSize: 48, lineHeight: 52, ...tipo.cifras },
  leyenda: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  oro: { ...tipo.secundario, color: tema.acento },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, paddingHorizontal: 16 },
  fila: {
    minHeight: 64,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.borde,
  },
  flex: { flex: 1, gap: 4 },
  sesion: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, padding: 16, gap: 16 },
  cabeceraSesion: { gap: 4 },
  series: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  serie: { gap: 4, minHeight: 44 },
  valor: {
    ...tipo.cuerpo,
    fontSize: 14,
    fontFamily: tema.fuenteBoton,
    color: tema.texto,
    ...tipo.cifras,
  },
  aviso: { color: tema.aviso },
})
