import { View } from "react-native"
import { Esqueleto, GrupoEsqueletos } from "../componentes/esqueleto"

export function EsqueletoEntrenamiento({ hoy = false }: { hoy?: boolean }): React.JSX.Element {
  return (
    <GrupoEsqueletos>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={hoy ? "Cargando entrenamientos de hoy" : "Cargando entrenamientos"}
        style={{ gap: 24 }}
      >
        {hoy ? (
          <>
            <View style={{ gap: 12 }}>
              <Esqueleto alto={176} radio={20} />
              <Esqueleto alto={44} ancho="70%" />
              <Esqueleto alto={52} ancho="85%" />
              <Esqueleto alto={52} />
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {Array.from({ length: 7 }, (_, i) => (
                <Esqueleto key={i} alto={68} estilo={{ flex: 1 }} />
              ))}
            </View>
            <Esqueleto alto={168} radio={20} />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <Esqueleto key={i} alto={72} radio={14} />)
        )}
      </View>
    </GrupoEsqueletos>
  )
}
