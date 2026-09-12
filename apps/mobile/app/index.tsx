import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * Pantalla provisional de sesion iniciada.
 *
 * Demuestra que la sesion existe y sobrevive a cerrar la app. La sustituye el
 * inicio real del cliente cuando llegue el modulo `agenda`.
 */
export default function Inicio(): React.JSX.Element {
  const { estado, salir } = useSesion()

  if (estado.fase !== "dentro") {
    return <SafeAreaView style={estilos.pantalla} />
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.contenido}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.lema}>TRAINING</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>SESIÓN INICIADA</Text>
          <Text style={estilos.valor}>{estado.usuario.email}</Text>
          <Text style={estilos.perfil}>{estado.usuario.rol.toUpperCase()}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [estilos.boton, pressed && estilos.botonPulsado]}
          onPress={() => void salir()}
          accessibilityRole="button"
        >
          <Text style={estilos.textoBoton}>CERRAR SESIÓN</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  marca: { color: tema.oro, fontSize: 24, letterSpacing: 4, fontWeight: "700" },
  lema: { color: tema.textoTenue, fontSize: 12, letterSpacing: 8, marginTop: 4, marginBottom: 40 },
  tarjeta: {
    alignSelf: "stretch",
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 6,
  },
  titulo: { color: tema.oroSuave, fontSize: 11, letterSpacing: 2, marginBottom: 8 },
  valor: { color: tema.texto, fontSize: 16 },
  perfil: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2 },
  boton: {
    alignSelf: "stretch",
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  botonPulsado: { opacity: 0.6 },
  textoBoton: { color: tema.textoTenue, fontSize: 13, fontWeight: "600", letterSpacing: 2 },
})
