import { useRouter } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Pulsable } from "../src/componentes/pulsable"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * Pantalla provisional de sesion iniciada.
 *
 * Demuestra que la sesion existe y da acceso al perfil. La sustituye el inicio
 * real del cliente cuando llegue el modulo `agenda`.
 */
export default function Inicio(): React.JSX.Element {
  const { estado, salir } = useSesion()
  const router = useRouter()

  if (estado.fase !== "dentro") {
    return <SafeAreaView style={estilos.pantalla} />
  }

  const { usuario } = estado
  const nombreCompleto = [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ")

  return (
    <SafeAreaView style={estilos.pantalla}>
      <View style={estilos.contenido}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.lema}>TRAINING</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>SESIÓN INICIADA</Text>
          <Text style={estilos.valor}>{nombreCompleto}</Text>
          <Text style={estilos.secundario}>{usuario.email}</Text>
          <Text style={estilos.perfil}>{usuario.rol.toUpperCase()}</Text>
        </View>

        {/* Esconder el boton es comodidad, no seguridad: quien entre a la ruta a
            mano se encuentra con el 403 del servidor, que es quien decide. */}
        {usuario.rol === "entrenador" && (
          <>
            <Pulsable
              style={estilos.botonPrincipal}
              onPress={() => {
                router.push("/cartera")
              }}
              accessibilityRole="button"
            >
              <Text style={estilos.textoPrincipal}>MI CARTERA</Text>
            </Pulsable>

            <Pulsable
              style={estilos.boton}
              onPress={() => {
                router.push("/nutricionista")
              }}
              accessibilityRole="button"
            >
              <Text style={estilos.textoBoton}>NUTRICIONISTA</Text>
            </Pulsable>
          </>
        )}

        {usuario.rol === "nutricionista" && (
          <Pulsable
            style={estilos.botonPrincipal}
            onPress={() => {
              router.push("/mis-clientes")
            }}
            accessibilityRole="button"
          >
            <Text style={estilos.textoPrincipal}>MIS CLIENTES</Text>
          </Pulsable>
        )}

        <Pulsable
          style={estilos.boton}
          onPress={() => {
            router.push("/perfil")
          }}
          accessibilityRole="button"
        >
          <Text style={estilos.textoBoton}>MI PERFIL</Text>
        </Pulsable>

        <Pulsable style={estilos.boton} onPress={() => void salir()} accessibilityRole="button">
          <Text style={estilos.textoBoton}>CERRAR SESIÓN</Text>
        </Pulsable>
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
  valor: { color: tema.texto, fontSize: 18 },
  secundario: { color: tema.textoTenue, fontSize: 13 },
  perfil: { color: tema.textoTenue, fontSize: 12, letterSpacing: 2, marginTop: 4 },
  botonPrincipal: {
    alignSelf: "stretch",
    backgroundColor: tema.oro,
    borderRadius: 8,
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
  },
  textoPrincipal: { color: tema.fondo, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  boton: {
    alignSelf: "stretch",
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  textoBoton: { color: tema.textoTenue, fontSize: 13, fontWeight: "600", letterSpacing: 2 },
})
