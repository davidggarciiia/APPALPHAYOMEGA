import { StyleSheet, Text, View } from "react-native"
import type { EstadoUsuario } from "@alpha-omega/shared"

import { tema } from "../tema"

/**
 * El estado no se distingue solo por color.
 *
 * Un punto de color no dice nada a quien no distingue esos dos tonos, ni a quien
 * usa un lector de pantalla. La palabra va siempre escrita.
 */
export const ETIQUETA_DE_ESTADO: Record<EstadoUsuario, string> = {
  pendiente: "PENDIENTE",
  activo: "ACTIVO",
  desactivado: "BAJA",
}

/**
 * Vive en un componente compartido para que la lista y la ficha no tengan dos
 * verdades distintas sobre cómo se llama una baja.
 */
export function InsigniaDeEstado({ estado }: { estado: EstadoUsuario }): React.JSX.Element {
  return (
    <View style={[estilos.insignia, estilos[estado]]}>
      <Text style={[estilos.texto, estilos[`texto_${estado}`]]}>{ETIQUETA_DE_ESTADO[estado]}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  insignia: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  texto: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  pendiente: { backgroundColor: "#2A2413", borderColor: tema.oro },
  activo: { backgroundColor: "transparent", borderColor: tema.borde },
  desactivado: { backgroundColor: "transparent", borderColor: tema.borde },
  texto_pendiente: { color: tema.oroSuave },
  texto_activo: { color: tema.texto },
  texto_desactivado: { color: tema.textoTenue },
})
