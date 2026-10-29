import { StyleSheet, Text, View } from "react-native"
import { ETIQUETA_DE_ZONA, type ListadoResultados, type Molestia } from "@alpha-omega/shared"

import { Pulsable } from "../../componentes/pulsable"
import { fechaLegible } from "../../entrenamiento/fechas"
import { espacio, radio, tema, tipo } from "../../tema"
import { textoDeMolestia } from "./atencion"

const COLOR = { verde: tema.exito, ambar: tema.aviso, rojo: tema.error } as const

/** El histórico de molestias conserva también las indicaciones ya atendidas. */
export function CheckinsYMolestias({
  molestias,
  responder,
}: {
  resultados: ListadoResultados["resultados"]
  molestias: Molestia[]
  responder: (molestia: Molestia) => void
}): React.JSX.Element {
  if (molestias.length === 0) return <Text style={s.tenue}>Ninguna molestia registrada.</Text>
  return (
    <View style={s.contenido}>
      {molestias.map((m) => {
        const { titulo, detalle } = textoDeMolestia(m)
        return (
          <View key={m.id} style={[s.tarjeta, m.estado === "atendida" && s.atendida]}>
            <View testID="molestia-nivel" style={[s.nivel, { backgroundColor: COLOR[m.nivel] }]} />
            <View style={s.cuerpo}>
              <Text style={s.fuerte}>
                {ETIQUETA_DE_ZONA[m.zona]} · {m.intensidad} de 10
              </Text>
              <Text style={s.tenue}>
                {fechaLegible(m.creadaEn.slice(0, 10))} · {detalle}
              </Text>
              <View style={s.pie}>
                <Text
                  style={[s.estado, m.estado === "atendida" ? s.estadoAtendida : s.estadoAbierta]}
                >
                  {m.estado === "abierta" ? "Abierta" : "Atendida"}
                </Text>
                {m.estado === "abierta" && (
                  <Pulsable
                    accessibilityLabel={`Responder: ${titulo}`}
                    onPress={() => responder(m)}
                    style={s.responder}
                  >
                    <Text style={s.textoResponder}>Responder</Text>
                  </Pulsable>
                )}
              </View>
              {m.respuesta && <Text style={s.respuesta}>Tu respuesta: {m.respuesta}</Text>}
            </View>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  contenido: { gap: espacio[16] },
  tarjeta: {
    flexDirection: "row",
    borderRadius: radio.tarjeta,
    backgroundColor: tema.superficie,
    overflow: "hidden",
  },
  atendida: { opacity: 0.65 },
  nivel: { width: 4 },
  cuerpo: { flex: 1, gap: espacio[8], padding: espacio[16] },
  fuerte: { ...tipo.fila, color: tema.texto },
  tenue: tipo.secundario,
  pie: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: espacio[12],
  },
  estado: {
    ...tipo.micro,
    borderRadius: radio.celda,
    paddingHorizontal: espacio[8],
    paddingVertical: espacio[4],
  },
  estadoAbierta: { color: tema.aviso, backgroundColor: tema.acentoSuave },
  estadoAtendida: { color: tema.exito, backgroundColor: tema.exitoSuave },
  responder: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: espacio[12],
    borderRadius: radio.celda,
  },
  textoResponder: { ...tipo.secundario, color: tema.acento, fontFamily: tema.fuenteSemi },
  respuesta: { ...tipo.cuerpo, color: tema.textoSecundario },
})
