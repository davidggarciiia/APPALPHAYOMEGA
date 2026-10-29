import { StyleSheet, Text, View } from "react-native"

import { tema } from "../tema"
import { Icono, type NombreIcono } from "./iconos"

/**
 * Pantalla a la que aún no ha llegado contenido: un icono, qué falta y por qué,
 * centrados en el espacio libre en lugar de una frase suelta arriba del todo.
 */
export function EstadoVacio({
  icono,
  titulo,
  texto,
}: {
  icono: NombreIcono
  titulo: string
  texto: string
}): React.JSX.Element {
  return (
    <View style={s.contenedor}>
      <View accessible={false} aria-hidden>
        <Icono nombre={icono} color={tema.textoTenue} tamano={48} />
      </View>
      <Text style={s.titulo} accessibilityRole="header">
        {titulo}
      </Text>
      <Text style={s.texto}>{texto}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  contenedor: { alignItems: "center", gap: 12, paddingVertical: 72, paddingHorizontal: 24 },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 24,
    textTransform: "uppercase",
  },
  texto: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
})
