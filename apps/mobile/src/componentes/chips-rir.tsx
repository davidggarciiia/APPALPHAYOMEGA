import { Pressable, StyleSheet, Text, View } from "react-native"

import { radio, tema } from "../tema"

export type ChipsRirProps = {
  valor: number | null
  cambiar: (valor: number) => void
  objetivo?: number | null
  etiqueta?: string
  deshabilitado?: boolean
}

/** Selector compartido por el registro y el RIR objetivo del constructor. */
export function ChipsRir({
  valor,
  cambiar,
  objetivo,
  etiqueta = "Repeticiones en reserva",
  deshabilitado = false,
}: ChipsRirProps): React.JSX.Element {
  return (
    <View style={s.opciones} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
      {[0, 1, 2, 3, 4, 5].map((rir) => {
        const elegido = valor === rir
        const meta = objetivo === rir
        const bajo = objetivo !== null && objetivo !== undefined && rir < objetivo
        return (
          <Pressable
            key={rir}
            accessibilityRole="radio"
            accessibilityLabel={`RIR ${rir === 5 ? "5 o más" : rir}${meta ? ", objetivo" : bajo ? ", por debajo del objetivo" : ""}`}
            accessibilityState={{ checked: elegido, disabled: deshabilitado }}
            aria-checked={elegido}
            disabled={deshabilitado}
            onPress={() => cambiar(rir)}
            style={[
              s.chip,
              elegido && s.elegido,
              meta && s.objetivo,
              bajo && s.bajo,
              deshabilitado && s.deshabilitado,
            ]}
          >
            <Text style={[s.texto, elegido && s.textoElegido, bajo && s.textoBajo]}>
              {rir === 5 ? "5+" : rir}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  opciones: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    minWidth: 46,
    minHeight: 48,
    flexGrow: 1,
    borderRadius: radio.celda,
    borderWidth: 1,
    borderColor: tema.bordeFuerte,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  elegido: { backgroundColor: tema.acentoSuave, borderColor: tema.acento },
  objetivo: { borderColor: tema.acento, borderStyle: "dashed" },
  bajo: { borderColor: tema.aviso, borderStyle: "dashed" },
  texto: {
    color: tema.texto,
    fontFamily: tema.fuenteSemi,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },
  textoElegido: { color: tema.acento },
  textoBajo: { color: tema.aviso },
  deshabilitado: { opacity: 0.5 },
})
