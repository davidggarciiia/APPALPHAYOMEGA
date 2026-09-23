import { StyleSheet, Text, View } from "react-native"
import type {
  Prescripcion,
  ResultadoEntrenamiento,
  SeriePrescrita,
  ValoresEjecutados,
} from "@alpha-omega/shared"
import { tema } from "../tema"

export function valoresLegibles(serie: SeriePrescrita | ValoresEjecutados): string {
  return `${serie.tipoMedicion === "tiempo" ? `${serie.segundos} s` : `${serie.repeticiones} rep`}${serie.pesoKg === null ? "" : ` · ${serie.pesoKg} kg`}`
}
export function PrescripcionVisible({
  prescripcion,
  resultado,
}: {
  prescripcion: Prescripcion
  resultado?: ResultadoEntrenamiento
}): React.JSX.Element {
  return (
    <View style={{ gap: 18 }}>
      {resultado && (
        <View style={estilos.cabecera}>
          <View style={estilos.circulo}>
            <Text style={estilos.marca}>✓</Text>
          </View>
          <Text style={estilos.titulo} accessibilityRole="header">
            Entrenamiento enviado
          </Text>
          <View style={estilos.datos}>
            <View style={estilos.dato}>
              <Text style={estilos.cifra}>
                {resultado.series.filter((serie) => serie.hecha).length}/{resultado.series.length}
              </Text>
              <Text style={estilos.leyenda}>series completadas</Text>
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
        <View
          key={e.id}
          style={{
            gap: 10,
            borderWidth: 1,
            borderColor: tema.borde,
            borderRadius: 18,
            padding: 16,
            backgroundColor: tema.superficie,
          }}
        >
          <Text style={{ color: tema.texto, fontSize: 26, fontFamily: tema.fuenteTitulo }}>
            {e.nombre}
          </Text>
          {e.indicaciones && <Text style={{ color: tema.textoTenue }}>{e.indicaciones}</Text>}
          {e.series.map((s, n) => {
            const real = resultado?.series.find((r) => r.serieId === s.id)
            return (
              <View key={s.id} style={{ gap: 4 }}>
                <Text style={{ color: tema.textoTenue }}>
                  Serie {n + 1} · Objetivo: {valoresLegibles(s)}
                </Text>
                {real && (
                  <Text style={real.hecha ? estilos.hecha : estilos.omitida}>
                    {real.hecha ? `Hecho: ${valoresLegibles(real.valores)}` : "Omitida"}
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      ))}
      {resultado?.notas && (
        <View>
          <Text style={{ color: tema.texto, fontWeight: "700" }}>Notas del entrenamiento</Text>
          <Text style={{ color: tema.texto }}>{resultado.notas}</Text>
        </View>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  cabecera: { gap: 14, alignItems: "center", paddingVertical: 24 },
  circulo: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: tema.boton,
    alignItems: "center",
    justifyContent: "center",
  },
  marca: { color: tema.sobreAcento, fontSize: 44, fontFamily: tema.fuenteBoton },
  titulo: {
    color: tema.texto,
    fontSize: 40,
    lineHeight: 40,
    fontFamily: tema.fuenteTitulo,
    textTransform: "uppercase",
    textAlign: "center",
  },
  datos: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  dato: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borde,
  },
  cifra: { color: tema.texto, fontSize: 28, fontFamily: tema.fuenteTitulo },
  leyenda: { color: tema.textoTenue, fontSize: 12, fontFamily: tema.fuenteTexto },
  hecha: { color: tema.exito, fontFamily: tema.fuenteBoton },
  omitida: { color: tema.textoTenue, fontFamily: tema.fuenteTexto },
})
