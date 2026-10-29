import { StyleSheet, Text, View } from "react-native"
import type { ResultadoEntrenamiento, ValoresEjecutados } from "@alpha-omega/shared"
import type { PrescripcionConDistancia, SerieConDistancia } from "./registro-modelo"
import { kg, seriesDeTrabajo } from "./sesion/modelo"
import { Icono } from "../componentes/iconos"
import { degradadoExito, tema } from "../tema"

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
export function PrescripcionVisible({
  prescripcion,
  resultado,
}: {
  prescripcion: PrescripcionConDistancia
  resultado?: ResultadoConDistancia
}): React.JSX.Element {
  const trabajo = seriesDeTrabajo(resultado?.prescripcion ?? prescripcion)
  return (
    <View style={estilos.contenedor}>
      {resultado && (
        <View style={estilos.cabecera}>
          <View style={[estilos.circulo, degradadoExito]}>
            <Icono nombre="hecho" color={tema.sobreExito} tamano={44} />
          </View>
          <Text style={estilos.titulo} accessibilityRole="header">
            Entrenamiento enviado
          </Text>
          <View style={estilos.datos}>
            <View style={estilos.dato}>
              <Text style={estilos.cifra}>
                {
                  resultado.series.filter((serie) => serie.hecha && trabajo.includes(serie.serieId))
                    .length
                }
                /{trabajo.length}
              </Text>
              <Text style={estilos.leyenda}>series de la parte principal completadas</Text>
            </View>
            <View style={estilos.dato}>
              <Text style={estilos.cifra}>
                {new Date(resultado.enviadoEn).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </Text>
              <Text style={estilos.leyenda}>
                enviado a las{" "}
                {new Date(resultado.enviadoEn).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        </View>
      )}
      {prescripcion.ejercicios.map((e) => (
        <View key={e.id} style={estilos.ejercicio}>
          <Text style={estilos.nombre} accessibilityRole="header">
            {e.nombre}
          </Text>
          {e.indicaciones && <Text style={estilos.indicaciones}>{e.indicaciones}</Text>}
          <View style={estilos.lista}>
            {e.series.map((s, n) => {
              const real = resultado?.series.find((r) => r.serieId === s.id)
              return (
                <View
                  key={s.id}
                  style={[estilos.renglon, n < e.series.length - 1 && estilos.separado]}
                >
                  <Text style={estilos.objetivo}>
                    Serie {n + 1} · Objetivo: {valoresLegibles(s)}
                  </Text>
                  {real && (
                    <Text style={real.hecha ? estilos.hecha : estilos.omitida}>
                      {real.hecha
                        ? `Hecho: ${valoresLegibles(real.valores)}`
                        : real.omitida
                          ? "Omitida"
                          : "Sin hacer"}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      ))}
      {resultado?.notas && (
        <View style={estilos.notas}>
          <Text style={estilos.nombre}>Notas del entrenamiento</Text>
          <Text style={estilos.texto}>{resultado.notas}</Text>
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  contenedor: { gap: 24 },
  cabecera: { gap: 16, alignItems: "center", paddingVertical: 16 },
  circulo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    color: tema.texto,
    fontSize: 34,
    lineHeight: 38,
    fontFamily: tema.fuenteTitulo,
    textTransform: "uppercase",
    textAlign: "center",
  },
  datos: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  dato: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: tema.superficie, gap: 4 },
  cifra: { color: tema.acento, fontSize: 34, lineHeight: 38, fontFamily: tema.fuenteTitulo },
  leyenda: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  ejercicio: { gap: 8 },
  nombre: { color: tema.texto, fontSize: 20, lineHeight: 25, fontFamily: tema.fuenteBoton },
  indicaciones: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  lista: { backgroundColor: tema.superficie, borderRadius: 20, paddingHorizontal: 16 },
  renglon: { paddingVertical: 12, gap: 4 },
  separado: { borderBottomWidth: 1, borderBottomColor: tema.borde },
  objetivo: { color: tema.textoTenue, fontSize: 15, fontFamily: tema.fuenteTexto },
  hecha: { color: tema.exito, fontSize: 15, fontFamily: tema.fuenteBoton },
  omitida: { color: tema.textoTenue, fontSize: 15, fontFamily: tema.fuenteSemi },
  notas: { gap: 6 },
  texto: { color: tema.texto, fontSize: 15, lineHeight: 21, fontFamily: tema.fuenteTexto },
})
