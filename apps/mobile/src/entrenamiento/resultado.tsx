import { StyleSheet, Text, View } from "react-native"
import type { Registro, ResultadoEntrenamiento, ValoresEjecutados } from "@alpha-omega/shared"
import type { PrescripcionConDistancia, SerieConDistancia } from "./registro-modelo"
import { ejerciciosOrdenados, kg } from "./sesion/modelo"
import { alto, espacio, radio, tema, tipo } from "../tema"

export { ConfirmacionSesion } from "./confirmacion-sesion"

export type ResultadoConDistancia = ResultadoEntrenamiento

/** «8 rep · 60 kg», «30 s» o «20 m · 32 kg»: cada cantidad en su unidad. */
export function valoresLegibles(serie: SerieConDistancia | ValoresEjecutados): string {
  const peso = serie.pesoKg === null ? "" : ` · ${kg(serie.pesoKg)}`
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return `${serie.repeticiones} rep${peso}`
    case "tiempo":
      return `${serie.segundos} s${peso}`
    case "distancia":
      return `${serie.metros} m${peso}`
  }
}

/** La tabla conserva la unidad y el rango prescrito, con la carga delante. */
function valoresDeFila(
  serie: SerieConDistancia | ValoresEjecutados | Registro["series"][number],
): string {
  let cantidad: string
  switch (serie.tipoMedicion) {
    case "repeticiones": {
      const maximo = "repeticionesMax" in serie ? serie.repeticionesMax : undefined
      cantidad =
        maximo !== undefined && maximo !== serie.repeticiones
          ? `${serie.repeticiones}–${maximo}`
          : String(serie.repeticiones ?? "—")
      break
    }
    case "tiempo":
      cantidad = `${serie.segundos ?? "—"} s`
      break
    case "distancia":
      cantidad = `${serie.metros ?? "—"} m`
      break
  }
  return serie.pesoKg === null
    ? `${cantidad}${serie.tipoMedicion === "repeticiones" ? " rep" : ""}`
    : `${kg(serie.pesoKg)} × ${cantidad}`
}

export function PrescripcionVisible({
  prescripcion,
  resultado,
  registro,
}: {
  prescripcion: PrescripcionConDistancia
  resultado?: ResultadoConDistancia
  /** Copia comprometida del envío pendiente; no equivale a un resultado del servidor. */
  registro?: Registro
}): React.JSX.Element {
  const receta = resultado?.prescripcion ?? prescripcion
  const reales = new Map(resultado?.series.map((serie) => [serie.serieId, serie]))
  const comprometidas = new Map(
    !resultado ? registro?.series.map((serie) => [serie.serieId, serie]) : undefined,
  )
  const notas = resultado ? resultado.notas : registro?.notas
  return (
    <View style={estilos.contenedor}>
      {ejerciciosOrdenados(receta).map((e) => (
        <View key={e.id} style={estilos.ejercicio}>
          <Text style={estilos.nombre} accessibilityRole="header">
            {e.nombre}
          </Text>
          {e.indicaciones && <Text style={estilos.indicaciones}>{e.indicaciones}</Text>}
          <View style={estilos.lista}>
            <View style={estilos.columnas} accessible={false}>
              <Text style={[estilos.micro, estilos.numero]}>Nº</Text>
              <Text style={[estilos.micro, estilos.hecho]}>HECHO</Text>
              <Text style={[estilos.micro, estilos.objetivo]}>OBJETIVO</Text>
              <Text style={[estilos.micro, estilos.rir]}>RIR</Text>
            </View>
            {e.series.map((s, n) => {
              const recibida = reales.get(s.id)
              const comprometida = comprometidas.get(s.id)
              const real = recibida ?? comprometida
              const omitida = real && !real.hecha && real.omitida
              const valores = recibida?.hecha
                ? recibida.valores
                : comprometida?.hecha
                  ? comprometida
                  : undefined
              const hecho = valores
                ? valoresDeFila(valores)
                : omitida
                  ? "Omitida"
                  : resultado || registro
                    ? "Sin hacer"
                    : "—"
              const objetivo = valoresDeFila(s)
              const rir = valores?.rir
              const rango = e.rir
                ? e.rir.min === e.rir.max
                  ? String(e.rir.min)
                  : `${e.rir.min}–${e.rir.max}`
                : null
              const etiquetaRir = `RIR ${rir ?? "sin registrar"}${rango ? `, objetivo ${rango}` : ""}`
              return (
                <View
                  key={s.id}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Serie ${n + 1}. Hecho: ${hecho}. Objetivo: ${objetivo}. ${etiquetaRir}`}
                  style={[
                    estilos.renglon,
                    real?.hecha && estilos.filaHecha,
                    omitida && estilos.omitida,
                  ]}
                >
                  <Text style={[estilos.indicaciones, estilos.numero]}>{n + 1}</Text>
                  <Text
                    style={[estilos.valor, estilos.hecho, !real?.hecha && estilos.indicaciones]}
                  >
                    {hecho}
                  </Text>
                  <Text style={[estilos.indicaciones, estilos.objetivo]}>{objetivo}</Text>
                  <Text
                    accessibilityLabel={etiquetaRir}
                    style={[
                      estilos.valor,
                      estilos.rir,
                      rir != null && e.rir && rir < e.rir.min && estilos.aviso,
                    ]}
                  >
                    {rir == null ? "—" : rir === 5 ? "5+" : rir}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      ))}
      {notas && (
        <View style={estilos.notas}>
          <Text style={estilos.nombre}>Notas del entrenamiento</Text>
          <Text style={estilos.texto}>{notas}</Text>
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: espacio[24] },
  ejercicio: { gap: espacio[8] },
  nombre: { ...tipo.titulo, color: tema.texto, fontSize: 18, lineHeight: 22 },
  indicaciones: { ...tipo.secundario, ...tipo.cifras },
  lista: { gap: espacio[4] },
  columnas: {
    flexDirection: "row",
    gap: espacio[8],
    paddingHorizontal: espacio[8],
    paddingVertical: espacio[4],
  },
  micro: { ...tipo.micro, color: tema.textoTenue },
  renglon: {
    minHeight: alto.tactil,
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[8],
    padding: espacio[8],
    borderRadius: radio.celda,
  },
  numero: { width: 22 },
  hecho: { flex: 1, minWidth: 0 },
  objetivo: { flex: 1, minWidth: 0 },
  rir: { width: 32, textAlign: "center" },
  valor: { ...tipo.cuerpo, ...tipo.cifras, color: tema.texto, fontFamily: tema.fuenteBoton },
  filaHecha: { backgroundColor: tema.exitoFila },
  omitida: { opacity: 0.5 },
  aviso: { color: tema.aviso },
  notas: { gap: espacio[8] },
  texto: { ...tipo.cuerpo, color: tema.texto },
})
