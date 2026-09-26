import { StyleSheet, Text, View } from "react-native"
import type { ResultadoEntrenamiento, ResultadoSerie, SeriePrescrita } from "@alpha-omega/shared"

import { formatearNumero } from "../entrenamiento-cliente/valores"
import { tema } from "../tema"

/** «40 kg × 10» o «45 s», con unidades siempre escritas. */
export function describirObjetivo(serie: SeriePrescrita): string {
  const valor =
    serie.tipoMedicion === "repeticiones"
      ? `${String(serie.repeticiones)} reps`
      : `${String(serie.segundos)} s`
  return serie.pesoKg === null ? valor : `${formatearNumero(serie.pesoKg)} kg × ${valor}`
}

function describirHecho(serie: ResultadoSerie): string {
  if (!serie.hecha) {
    return "No realizada"
  }
  const { valores } = serie
  const valor =
    valores.tipoMedicion === "repeticiones"
      ? `${String(valores.repeticiones)} reps`
      : `${String(valores.segundos)} s`
  return valores.pesoKg === null ? valor : `${formatearNumero(valores.pesoKg)} kg × ${valor}`
}

/**
 * Lo previsto frente a lo hecho, serie a serie.
 *
 * Lo usan el cliente (su resultado enviado) y el entrenador. Una serie sin
 * marcar dice «No realizada»: nunca se enseña el objetivo como si se hubiera hecho.
 */
export function ResultadoSesion({
  resultado,
}: {
  resultado: ResultadoEntrenamiento
}): React.JSX.Element {
  const porSerie = new Map(resultado.series.map((serie) => [serie.serieId, serie]))
  const hechas = resultado.series.filter((serie) => serie.hecha).length

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.resumen}>
        {`${String(hechas)} de ${String(resultado.series.length)} series hechas`}
      </Text>
      {resultado.prescripcion.ejercicios.map((ejercicio) => (
        <View key={ejercicio.id} style={estilos.tarjeta}>
          <Text style={estilos.ejercicio}>{ejercicio.nombre}</Text>
          <View style={estilos.fila}>
            <Text style={[estilos.numero, estilos.encabezado]}>SERIE</Text>
            <Text style={[estilos.columna, estilos.encabezado]}>OBJETIVO</Text>
            <Text style={[estilos.columna, estilos.encabezado]}>REALIZADO</Text>
          </View>
          {ejercicio.series.map((serie, indice) => {
            const hecha = porSerie.get(serie.id)
            const realizada = hecha?.hecha === true
            return (
              <View
                key={serie.id}
                style={estilos.fila}
                accessible
                accessibilityLabel={`Serie ${String(indice + 1)}. Objetivo ${describirObjetivo(serie)}. ${
                  hecha === undefined ? "No realizada" : describirHecho(hecha)
                }`}
              >
                <Text style={estilos.numero}>{String(indice + 1)}</Text>
                <Text style={[estilos.columna, estilos.objetivo]}>{describirObjetivo(serie)}</Text>
                <Text style={[estilos.columna, realizada ? estilos.hecho : estilos.omitida]}>
                  {hecha === undefined ? "No realizada" : describirHecho(hecha)}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      {resultado.notas !== null && (
        <View style={estilos.tarjeta}>
          <Text style={estilos.encabezado}>NOTAS</Text>
          <Text style={estilos.notas}>{resultado.notas}</Text>
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 12 },
  resumen: { color: tema.oroSuave, fontSize: 13, letterSpacing: 1 },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  ejercicio: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  columna: { flex: 1, color: tema.texto, fontSize: 14 },
  // Ancho fijo sin `flex`: en web, `flex: 0` anula el ancho y descuadra la tabla.
  numero: { width: 48, color: tema.texto, fontSize: 14 },
  encabezado: { color: tema.textoTenue, fontSize: 10, letterSpacing: 1.5, fontWeight: "700" },
  objetivo: { color: tema.textoTenue },
  hecho: { color: tema.oroSuave, fontWeight: "600" },
  omitida: { color: tema.error, fontStyle: "italic" },
  notas: { color: tema.texto, fontSize: 14, lineHeight: 20 },
})
