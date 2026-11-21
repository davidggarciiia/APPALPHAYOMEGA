import { Pressable, StyleSheet, Text, View } from "react-native"

import { alto, espacio, fondoDeMarca, radio, tema } from "../tema"

/**
 * Lo que se ve cuando una pantalla falla al pintarse, en lugar de una pantalla en
 * blanco. Sin hooks de sesión ni de navegación: tiene que poder pintarse aunque
 * lo que ha fallado sean precisamente ellos.
 */
export function PantallaDeError({ alReintentar }: { alReintentar: () => void }): React.JSX.Element {
  return (
    <View style={s.pantalla}>
      <Text accessibilityRole="header" style={s.titulo}>
        Algo ha fallado
      </Text>
      <Text style={s.texto}>
        Ha ocurrido un problema inesperado. Prueba otra vez; si sigue pasando, cierra la app y
        vuelve a abrirla.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        onPress={alReintentar}
        style={({ pressed }) => [s.boton, pressed && s.pulsado]}
      >
        <Text style={s.textoBoton}>REINTENTAR</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  pantalla: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: espacio[12],
    padding: espacio[24],
    ...fondoDeMarca,
  },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textAlign: "center",
    textTransform: "uppercase",
  },
  texto: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    textAlign: "center",
  },
  boton: {
    minHeight: alto.botonPrincipal,
    minWidth: 200,
    marginTop: espacio[16],
    paddingHorizontal: espacio[32],
    borderRadius: radio.campo,
    backgroundColor: tema.boton,
    alignItems: "center",
    justifyContent: "center",
  },
  pulsado: { opacity: 0.85 },
  textoBoton: { color: tema.sobreAcento, fontFamily: tema.fuenteBoton, fontSize: 16 },
})
