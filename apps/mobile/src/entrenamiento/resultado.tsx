import { Text, View } from "react-native"
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
        <View style={{ gap: 10, alignItems: "center", paddingVertical: 24 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: tema.acento,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: tema.sobreAcento, fontSize: 36 }}>✓</Text>
          </View>
          <Text
            style={{
              color: tema.texto,
              fontSize: 34,
              fontFamily: tema.fuenteTitulo,
              textAlign: "center",
            }}
          >
            Entrenamiento enviado
          </Text>
          <Text style={{ color: tema.textoTenue }}>
            {resultado.series.filter((s) => s.hecha).length} de {resultado.series.length} series
            completadas
          </Text>
          <Text style={{ color: tema.textoTenue }}>
            Enviado el {new Date(resultado.enviadoEn).toLocaleString("es-ES")}
          </Text>
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
                  <Text style={{ color: tema.texto, fontWeight: "600" }}>
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
