type PropiedadesAviso = {
  mensaje: string
  tipo?: "error" | "conexion"
  alReintentar?: () => void
}

export function Aviso({
  mensaje,
  tipo: variante = "conexion",
  alReintentar,
}: PropiedadesAviso): React.JSX.Element {
  const error = variante === "error"
  return (
    <View style={[s.aviso, error ? s.error : s.conexion]}>
      <Text
        accessibilityRole="alert"
        accessibilityLiveRegion={error ? "assertive" : "polite"}
        style={[s.texto, { color: error ? tema.error : tema.aviso }]}
      >
        {mensaje}
      </Text>
      {alReintentar && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          onPress={alReintentar}
          style={s.reintentar}
        >
          <Text style={[s.accion, { color: error ? tema.error : tema.aviso }]}>Reintentar</Text>
        </Pressable>
      )}
    </View>
  )
}
import { Pressable, StyleSheet, Text, View } from "react-native"

import { alto, espacio, radio, tema, tipo } from "../tema"

const s = StyleSheet.create({
  aviso: {
    minHeight: alto.tactil,
    borderRadius: radio.tarjetaInterna,
    paddingHorizontal: espacio[12],
    paddingVertical: espacio[8],
    flexDirection: "row",
    alignItems: "center",
    gap: espacio[12],
  },
  error: { backgroundColor: tema.errorSuave, borderWidth: 1, borderColor: tema.errorBorde },
  conexion: { backgroundColor: tema.acentoSuave },
  texto: { ...tipo.cuerpo, flex: 1 },
  reintentar: { minWidth: alto.tactil, minHeight: alto.tactil, justifyContent: "center" },
  accion: { fontFamily: tema.fuenteSemi, fontSize: 13 },
})
