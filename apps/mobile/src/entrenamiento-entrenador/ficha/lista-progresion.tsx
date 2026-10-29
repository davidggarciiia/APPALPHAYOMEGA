import { StyleSheet, Text, View } from "react-native"
import {
  compararSemanas,
  estadoDeProgresion,
  mejorSerieDeSesion,
  type ComparacionSemanal,
  type EstadoDeProgresion,
  type ListadoResultados,
  type ProgresionFuerza,
} from "@alpha-omega/shared"
import { Icono } from "../../componentes/iconos"
import { Pulsable } from "../../componentes/pulsable"
import { radio, tema, tipo } from "../../tema"
import {
  conRirDelHistorial,
  decimal,
  esEjercicioDeProgresion,
  historialDelEjercicio,
  serieLegible,
  semanasDeFuerza,
} from "./progresion-modelo"

function textoDelta(comparacion: ComparacionSemanal, estimado = false): string {
  const valor = estimado
    ? comparacion.diferencia1RM
    : comparacion.diferenciaKg || comparacion.diferenciaRepeticiones
  const unidad =
    estimado || comparacion.diferenciaKg !== 0 ? "kg" : Math.abs(valor) === 1 ? "rep" : "reps"
  return valor === 0 ? "Igual" : `${valor > 0 ? "+" : "−"}${decimal(Math.abs(valor))} ${unidad}`
}

export function EstadoProgresion({
  estado,
}: {
  estado: EstadoDeProgresion | null
}): React.JSX.Element | null {
  if (!estado) return null
  return (
    <Text style={[s.estado, estado === "Progresa" && s.progresa, estado === "Baja" && s.baja]}>
      {estado}
    </Text>
  )
}

export function DeltaProgresion({
  comparacion,
  estimado = false,
}: {
  comparacion: ComparacionSemanal | null
  estimado?: boolean
}): React.JSX.Element | null {
  if (!comparacion) return null
  const valor = estimado
    ? comparacion.diferencia1RM
    : comparacion.diferenciaKg || comparacion.diferenciaRepeticiones
  const texto = textoDelta(comparacion, estimado)
  const color = valor > 0 ? tema.exito : valor < 0 ? tema.aviso : tema.textoSecundario
  return (
    <View style={s.delta}>
      {valor !== 0 && (
        <View style={{ transform: [{ rotate: valor > 0 ? "-90deg" : "90deg" }] }}>
          <Icono nombre="adelante" tamano={16} color={color} />
        </View>
      )}
      <Text style={[s.cifra, { color }]}>{texto}</Text>
    </View>
  )
}

export function ListaProgresion({
  ejercicios,
  resultados,
  abrir,
}: {
  ejercicios: ProgresionFuerza["ejercicios"]
  resultados: ListadoResultados["resultados"]
  abrir: (ejercicioId: string) => void
}): React.JSX.Element {
  const nombres = new Map(
    ejercicios
      .filter((e) => esEjercicioDeProgresion(resultados, e.ejercicioId))
      .map((e) => [e.ejercicioId, e.nombre]),
  )
  for (const { resultado } of resultados) {
    for (const e of resultado.prescripcion.ejercicios) {
      if (
        (e.seccion ?? "principal") === "principal" &&
        resultado.series.some((s) => s.hecha && e.series.some((p) => p.id === s.serieId)) &&
        !nombres.has(e.ejercicioId)
      )
        nombres.set(e.ejercicioId, e.nombre)
    }
  }
  if (!nombres.size) return <Text style={s.tenue}>Aún sin ejercicios con historial.</Text>
  return (
    <View style={s.grupo}>
      <Text style={s.micro}>Ejercicios con historial</Text>
      <View style={s.lista}>
        {[...nombres]
          .sort((a, b) => a[1].localeCompare(b[1], "es"))
          .map(([id, nombre], i) => {
            const historial = historialDelEjercicio(resultados, id)
            const semanas = semanasDeFuerza(
              ejercicios.find((e) => e.ejercicioId === id)?.puntos ?? [],
              historial,
            )
            const estado = estadoDeProgresion(historial)
            const mejor =
              conRirDelHistorial(semanas.at(-1), historial) ??
              mejorSerieDeSesion(historial[0]?.series ?? [])
            const comparacion = compararSemanas(
              semanas.at(-1)?.serie ?? null,
              semanas.at(-2)?.serie ?? null,
            )
            const resumen = mejor
              ? `${serieLegible(mejor)} · ${mejor.rir == null ? "RIR —" : `RIR ${mejor.rir}`}`
              : "Ver sesiones"
            return (
              <Pulsable
                key={id}
                style={[s.fila, i > 0 && s.separador]}
                accessibilityLabel={`${nombre}, ${resumen}${comparacion ? `, ${textoDelta(comparacion)}` : ""}${estado ? `, ${estado}` : ""}`}
                onPress={() => abrir(id)}
              >
                <View style={s.flex}>
                  <Text style={s.nombre}>{nombre}</Text>
                  <Text style={s.tenue}>{resumen}</Text>
                </View>
                <View style={s.derecha}>
                  <DeltaProgresion comparacion={comparacion} />
                  <EstadoProgresion estado={estado} />
                </View>
                <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
              </Pulsable>
            )
          })}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  grupo: { gap: 12 },
  lista: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, overflow: "hidden" },
  fila: { minHeight: 68, padding: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  separador: { borderTopWidth: 1, borderTopColor: tema.borde },
  flex: { flex: 1, gap: 4 },
  nombre: { ...tipo.cuerpo, fontFamily: tema.fuenteBoton, color: tema.texto },
  tenue: tipo.secundario,
  micro: { ...tipo.micro, color: tema.textoTenue },
  derecha: { alignItems: "flex-end", gap: 4 },
  delta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cifra: { ...tipo.secundario, ...tipo.cifras },
  estado: {
    ...tipo.secundario,
    color: tema.textoSecundario,
    backgroundColor: tema.superficieAlta,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radio.celda,
  },
  progresa: { color: tema.exito, backgroundColor: tema.exitoSuave },
  baja: { color: tema.aviso, backgroundColor: tema.acentoSuave },
})
