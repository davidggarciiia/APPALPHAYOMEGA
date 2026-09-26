import { StyleSheet, Text, View } from "react-native"
import type { ResultadoEntrenamiento, ResultadoSerie, SeriePrescrita } from "@alpha-omega/shared"

import { formatearNumero } from "../entrenamiento-cliente/valores"
import { TarjetaDeFigura } from "../figuras/tarjeta-de-figura"
import { fuentes, tema } from "../tema"

import { RellenoVerde, Visto, texto } from "./diseno"

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
 * Lo previsto frente a lo hecho, serie a serie. Lo usan el cliente y el entrenador.
 *
 * Una serie sin marcar dice «No realizada»: nunca se enseña el objetivo como si
 * se hubiera hecho. Filas como las de Nutricion.dc.html: marca verde lo hecho,
 * aro vacío lo que no.
 */
export function ResultadoSesion({
  resultado,
  conFiguras = true,
}: {
  resultado: ResultadoEntrenamiento
  conFiguras?: boolean
}): React.JSX.Element {
  const porSerie = new Map(resultado.series.map((serie) => [serie.serieId, serie]))
  const hechas = resultado.series.filter((serie) => serie.hecha).length

  return (
    <View style={estilos.contenedor}>
      <View style={estilos.resumen}>
        <Text style={texto.seccion}>Series</Text>
        <Text
          style={estilos.cuenta}
        >{`${String(hechas)} de ${String(resultado.series.length)}`}</Text>
      </View>
      {resultado.prescripcion.ejercicios.map((ejercicio) => (
        <View key={ejercicio.id} style={estilos.ejercicio}>
          {conFiguras && <TarjetaDeFigura nombre={ejercicio.nombre} />}
          <Text style={texto.fuerte}>{ejercicio.nombre}</Text>
          <View style={estilos.lista}>
            {ejercicio.series.map((serie, indice) => {
              const hecha = porSerie.get(serie.id)
              const realizada = hecha?.hecha === true
              const ultima = indice === ejercicio.series.length - 1
              return (
                <View
                  key={serie.id}
                  style={[estilos.fila, !ultima && estilos.separador]}
                  accessible
                  accessibilityLabel={`Serie ${String(indice + 1)}. Objetivo ${describirObjetivo(serie)}. ${
                    hecha === undefined ? "No realizada" : describirHecho(hecha)
                  }`}
                >
                  <View style={[estilos.marca, !realizada && estilos.aro]}>
                    {realizada && (
                      <>
                        <RellenoVerde radio={16} />
                        <Visto tamano={14} />
                      </>
                    )}
                  </View>
                  <View style={estilos.flexible}>
                    <Text style={[estilos.hecho, !realizada && estilos.omitida]}>
                      {hecha === undefined ? "No realizada" : describirHecho(hecha)}
                    </Text>
                    <Text
                      style={texto.tenue}
                    >{`Serie ${String(indice + 1)} · objetivo ${describirObjetivo(serie)}`}</Text>
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      ))}
      {resultado.notas !== null && (
        <View style={estilos.ejercicio}>
          <Text style={texto.fuerte}>Notas</Text>
          <View style={estilos.notas}>
            <Text style={texto.cuerpo}>{resultado.notas}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 28 },
  resumen: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cuenta: {
    color: tema.oro,
    fontFamily: fuentes.negrita,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
  ejercicio: { gap: 12 },
  lista: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tema.bordeOro,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  fila: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10, minHeight: 52 },
  separador: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  marca: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  aro: { borderWidth: 2, borderColor: tema.aro },
  flexible: { flex: 1, gap: 2 },
  hecho: { color: tema.texto, fontFamily: fuentes.negrita, fontSize: 17 },
  omitida: { color: tema.textoTenue, fontFamily: fuentes.semi },
  notas: { backgroundColor: tema.superficie, borderRadius: 16, padding: 14 },
})
