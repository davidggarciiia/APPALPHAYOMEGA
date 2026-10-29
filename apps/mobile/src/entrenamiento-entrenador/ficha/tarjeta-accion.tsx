import { StyleSheet, Text, View } from "react-native"

import { BotonPrincipal, BotonSecundario } from "../../componentes/botones"
import { radio, tema } from "../../tema"

export function TarjetaDeAccion({
  titulo,
  detalle,
  accion,
  onPress,
  variante = "acento",
  principal = false,
  deshabilitado = false,
}: {
  titulo: string
  detalle: string
  accion: string
  onPress: () => void
  variante?: "acento" | "aviso" | "error"
  principal?: boolean
  deshabilitado?: boolean
}): React.JSX.Element {
  const Boton = principal ? BotonPrincipal : BotonSecundario
  return (
    <View
      style={[
        s.tarjeta,
        {
          borderColor:
            variante === "error"
              ? tema.errorBorde
              : variante === "aviso"
                ? tema.avisoBorde
                : tema.bordeDestacado,
        },
      ]}
    >
      <View style={[s.marca, { backgroundColor: tema[variante] }]} />
      <View style={s.textos}>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.detalle} numberOfLines={2}>
          {detalle}
        </Text>
      </View>
      <Boton
        texto={accion}
        etiquetaAccesible={`${accion}: ${titulo}`}
        onPress={onPress}
        deshabilitado={deshabilitado}
        compacto
        sinMargen
      />
    </View>
  )
}

const s = StyleSheet.create({
  tarjeta: {
    borderWidth: 1,
    borderRadius: radio.tarjeta,
    backgroundColor: tema.superficie,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  marca: { width: 8, height: 8, borderRadius: 2, alignSelf: "flex-start", marginTop: 7 },
  textos: { flex: 1, minWidth: 0, gap: 4 },
  titulo: { fontFamily: tema.fuenteBoton, fontSize: 15, lineHeight: 21, color: tema.texto },
  detalle: { fontFamily: tema.fuenteTexto, fontSize: 13, lineHeight: 18, color: tema.textoTenue },
})
