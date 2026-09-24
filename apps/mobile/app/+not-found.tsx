import { Link } from "expo-router"
import { StyleSheet, Text, View } from "react-native"

import { tema } from "../src/tema"

/**
 * Cualquier ruta que no exista acaba aqui.
 *
 * Sin esta pantalla, un enlace mal formado dejaba al usuario ante un error en
 * crudo de Expo Router, que en una app publicada es una pantalla de fallo sin
 * ninguna salida.
 */
export default function NoEncontrada(): React.JSX.Element {
  return (
    <View style={estilos.pantalla}>
      <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
      <Text style={estilos.titulo}>Esta pantalla no existe</Text>
      <Text style={estilos.detalle}>
        Si has llegado desde un enlace de correo, puede que haya caducado.
      </Text>
      <Link href="/" style={estilos.enlace}>
        Volver al inicio
      </Link>
    </View>
  )
}

const estilos = StyleSheet.create({
  pantalla: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.fondo,
    padding: 24,
  },
  marca: {
    fontFamily: tema.fuenteBoton,
    color: tema.acento,
    fontSize: 20,
    letterSpacing: 4,

    marginBottom: 32,
  },
  titulo: { fontFamily: tema.fuenteTexto, color: tema.texto, fontSize: 18, textAlign: "center" },
  detalle: {
    fontFamily: tema.fuenteTexto,
    color: tema.textoTenue,
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
  },
  enlace: {
    fontFamily: tema.fuenteTexto,
    color: tema.acento,
    fontSize: 14,
    marginTop: 28,
    letterSpacing: 1,
  },
})
