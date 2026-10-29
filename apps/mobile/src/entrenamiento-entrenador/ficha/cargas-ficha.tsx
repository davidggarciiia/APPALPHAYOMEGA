import { StyleSheet, Text, View } from "react-native"
import {
  compararSemanas,
  estadoDeProgresion,
  mejorSerieDeSesion,
  mejorSerieDeSemana,
  type EjercicioPrescrito,
  type ListadoResultados,
} from "@alpha-omega/shared"
import { Icono } from "../../componentes/iconos"
import { Pulsable } from "../../componentes/pulsable"
import { lunesDeSemana, sumarDias } from "../../entrenamiento/fechas"
import { radio, tema, tipo } from "../../tema"
import { DeltaProgresion, EstadoProgresion } from "./lista-progresion"
import { historialDelEjercicio, serieLegible } from "./progresion-modelo"

type CargaDeFicha = {
  ejercicio: EjercicioPrescrito
  actual: ReturnType<typeof mejorSerieDeSesion>
  anterior: ReturnType<typeof mejorSerieDeSesion>
  estado: ReturnType<typeof estadoDeProgresion>
  comparacion: ReturnType<typeof compararSemanas>
}

export function cargasDeFicha(
  resultados: ListadoResultados["resultados"],
  lunes: string,
): CargaDeFicha[] {
  const ordenados = [...resultados]
    .filter((r) => !!r.resultado.enviadoEn)
    .sort((a, b) => a.agenda.fechaActual.localeCompare(b.agenda.fechaActual))
  const actuales = ordenados.filter(
    (r) => r.agenda.fechaActual >= lunes && r.agenda.fechaActual < sumarDias(lunes, 7),
  )
  const fuentes = [
    ...actuales,
    ...[...ordenados].filter((r) => r.agenda.fechaActual < lunes).reverse(),
  ]
  const principales = fuentes.map((r) =>
    r.resultado.prescripcion.ejercicios.filter((e) => (e.seccion ?? "principal") === "principal"),
  )
  const vigentes = actuales.length ? principales.slice(0, actuales.length) : principales
  const compuestos = vigentes.some((lista) => lista.some((e) => e.compuesto))
  const candidatos = principales.flatMap((lista) =>
    compuestos ? lista.filter((e) => e.compuesto) : lista.slice(0, 1),
  )
  const unicos = new Map<string, EjercicioPrescrito>()
  for (const ejercicio of candidatos) {
    if (!unicos.has(ejercicio.ejercicioId)) unicos.set(ejercicio.ejercicioId, ejercicio)
  }
  return [...unicos.values()].slice(0, 4).map((ejercicio) => {
    const historial = historialDelEjercicio(resultados, ejercicio.ejercicioId).filter(
      (s) => s.fecha < sumarDias(lunes, 7),
    )
    const semanaAnterior = historial.find((s) => s.fecha < lunes && mejorSerieDeSesion(s.series))
    const anterior = semanaAnterior
      ? mejorSerieDeSemana(historial, lunesDeSemana(semanaAnterior.fecha))
      : null
    const actual = mejorSerieDeSemana(historial, lunes)
    return {
      ejercicio,
      actual,
      anterior,
      estado: actual ? estadoDeProgresion(historial) : null,
      comparacion: compararSemanas(actual, anterior),
    }
  })
}

export function CargasFicha({
  resultados,
  lunes,
  abrir,
}: {
  resultados: ListadoResultados["resultados"]
  lunes: string
  abrir: (id: string) => void
}): React.JSX.Element | null {
  const cargas = cargasDeFicha(resultados, lunes)
  if (!cargas.length) return null
  return (
    <View style={s.grupo}>
      <View style={s.leyenda}>
        <Text style={s.micro}>Mejor serie · kg × reps</Text>
        <Text style={s.tenue}>esta semana vs anterior</Text>
      </View>
      <View style={s.lista}>
        {cargas.map(({ ejercicio, actual, anterior, estado, comparacion }, i) => (
          <Pulsable
            key={ejercicio.ejercicioId}
            accessibilityLabel={`${ejercicio.nombre}. ${estado ? `${estado}. ` : ""}${comparacion ? `${String(comparacion.diferenciaKg || comparacion.diferenciaRepeticiones).replace(".", ",")} ${comparacion.diferenciaKg ? "kg" : "reps"}. ` : ""}${actual ? `${serieLegible(actual)}. RIR ${actual.rir ?? "sin registrar"}` : `Sin hacer${anterior ? `, antes ${serieLegible(anterior)}` : ""}`}`}
            style={[s.fila, i > 0 && s.separador]}
            onPress={() => abrir(ejercicio.ejercicioId)}
          >
            <View style={s.flex}>
              <Text style={s.nombre}>{ejercicio.nombre}</Text>
              <Text style={[s.tenue, tipo.cifras]}>
                {actual
                  ? `${serieLegible(actual)} · RIR ${actual.rir ?? "—"}`
                  : `Sin hacer${anterior ? ` · antes ${serieLegible(anterior)}` : ""}`}
              </Text>
            </View>
            <View style={s.derecha}>
              {actual ? (
                <>
                  <DeltaProgresion comparacion={comparacion} />
                  <EstadoProgresion estado={estado} />
                </>
              ) : (
                <Text style={s.tenue}>—</Text>
              )}
            </View>
            <Icono nombre="adelante" color={tema.textoTenue} tamano={18} />
          </Pulsable>
        ))}
      </View>
    </View>
  )
}
const s = StyleSheet.create({
  grupo: { gap: 12 },
  leyenda: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 4 },
  micro: { ...tipo.micro, color: tema.textoTenue },
  tenue: tipo.secundario,
  lista: { backgroundColor: tema.superficie, borderRadius: radio.tarjeta, overflow: "hidden" },
  fila: { minHeight: 68, flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  separador: { borderTopWidth: 1, borderTopColor: tema.borde },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  nombre: { ...tipo.cuerpo, fontFamily: tema.fuenteBoton, color: tema.texto },
  derecha: { alignItems: "flex-end", gap: 4 },
})
