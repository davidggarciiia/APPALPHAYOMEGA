import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import type { Registro, ResultadoEntrenamiento, ValoresEjecutados } from "@alpha-omega/shared"
import type {
  EjercicioConDistancia,
  PrescripcionConDistancia,
  SerieConDistancia,
} from "./registro-modelo"
import { ejerciciosOrdenados, kg, resumenPrescrito } from "./sesion/modelo"
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

function cantidadDe(
  serie: SerieConDistancia | ValoresEjecutados | Registro["series"][number],
): number | null {
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return serie.repeticiones
    case "tiempo":
      return serie.segundos
    case "distancia":
      return serie.metros
  }
}

export function PrescripcionVisible({
  prescripcion,
  resultado,
  registro,
  revision,
}: {
  prescripcion: PrescripcionConDistancia
  resultado?: ResultadoConDistancia
  /** Copia comprometida del envío pendiente; no equivale a un resultado del servidor. */
  registro?: Registro
  /** La revisión usa las mismas filas, con la prescripción delante y acciones por ejercicio. */
  revision?: {
    cabecera?: (ejercicio: EjercicioConDistancia) => ReactNode
    pie?: (ejercicio: EjercicioConDistancia) => ReactNode
  }
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
          <View style={estilos.cabecera}>
            <View style={estilos.textos}>
              <Text
                style={[estilos.nombre, revision && estilos.nombreRevision]}
                accessibilityRole="header"
              >
                {e.nombre}
              </Text>
              {revision && <Text style={estilos.indicaciones}>{resumenPrescrito(e)}</Text>}
            </View>
            {revision?.cabecera?.(e)}
          </View>
          {e.indicaciones && <Text style={estilos.indicaciones}>{e.indicaciones}</Text>}
          <View style={estilos.lista}>
            <View style={estilos.columnas} accessible={false}>
              <Text style={[estilos.micro, estilos.numero, revision && estilos.numeroRevision]}>
                {revision ? "SERIE" : "Nº"}
              </Text>
              {revision && <Text style={[estilos.micro, estilos.objetivo]}>PRESCRITO</Text>}
              <Text style={[estilos.micro, estilos.hecho]}>HECHO</Text>
              {!revision && <Text style={[estilos.micro, estilos.objetivo]}>OBJETIVO</Text>}
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
              const cantidad = valores ? cantidadDe(valores) : null
              const minimo = cantidadDe(s)
              const bajo =
                valores &&
                (valores.tipoMedicion !== s.tipoMedicion ||
                  (cantidad !== null && minimo !== null && cantidad < minimo) ||
                  (rir != null && e.rir && rir < e.rir.min))
              const cumple = valores && !bajo && (!e.rir || rir != null)
              const delta =
                valores?.pesoKg != null && s.pesoKg !== null && valores.pesoKg > s.pesoKg
                  ? valores.pesoKg - s.pesoKg
                  : null
              return (
                <View
                  key={s.id}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Serie ${n + 1}. Hecho: ${hecho}. Objetivo: ${objetivo}. ${etiquetaRir}${revision && valores ? (bajo ? ". Por debajo del objetivo" : cumple ? ". Cumple el objetivo" : "") : ""}`}
                  style={[
                    estilos.renglon,
                    (revision ? cumple : real?.hecha) && estilos.filaHecha,
                    revision && bajo && estilos.filaBaja,
                    omitida && estilos.omitida,
                  ]}
                >
                  <Text
                    style={[
                      estilos.indicaciones,
                      estilos.numero,
                      revision && estilos.numeroRevision,
                    ]}
                  >
                    {n + 1}
                  </Text>
                  {revision && (
                    <Text style={[estilos.indicaciones, estilos.objetivo]}>{objetivo}</Text>
                  )}
                  <View style={estilos.hecho}>
                    <Text style={[estilos.valor, !real?.hecha && estilos.indicaciones]}>
                      {hecho}
                    </Text>
                    {revision && delta !== null && (
                      <Text style={estilos.delta}>
                        +{String(Number(delta.toFixed(2))).replace(".", ",")}
                      </Text>
                    )}
                  </View>
                  {!revision && (
                    <Text style={[estilos.indicaciones, estilos.objetivo]}>{objetivo}</Text>
                  )}
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
          {revision?.pie?.(e)}
        </View>
      ))}
      {notas && !revision && (
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
  cabecera: { flexDirection: "row", alignItems: "flex-start", gap: espacio[8] },
  textos: { flex: 1, minWidth: 0, gap: espacio[4] },
  nombre: { ...tipo.titulo, color: tema.texto, fontSize: 18, lineHeight: 22 },
  nombreRevision: { ...tipo.titulo },
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
  numeroRevision: { width: 44 },
  hecho: { flex: 1, minWidth: 0 },
  objetivo: { flex: 1, minWidth: 0 },
  rir: { width: 32, textAlign: "center" },
  valor: { ...tipo.cuerpo, ...tipo.cifras, color: tema.texto, fontFamily: tema.fuenteBoton },
  filaHecha: { backgroundColor: tema.exitoFila },
  filaBaja: { backgroundColor: tema.acentoSuave },
  delta: { ...tipo.secundario, ...tipo.cifras, color: tema.acento, fontSize: 12 },
  omitida: { opacity: 0.5 },
  aviso: { color: tema.aviso },
  notas: { gap: espacio[8] },
  texto: { ...tipo.cuerpo, color: tema.texto },
})
