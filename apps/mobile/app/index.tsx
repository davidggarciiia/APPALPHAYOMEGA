import { useRouter } from "expo-router"
import { useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import { Pulsable } from "../src/componentes/pulsable"
import { hayPendientes } from "../src/entrenamiento-cliente/almacen-borradores"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

/**
 * Pantalla provisional de sesion iniciada.
 *
 * Demuestra que la sesion existe y da acceso al perfil. La sustituye el inicio
 * real del cliente cuando llegue el modulo `agenda`.
 */
export default function Inicio(): React.JSX.Element {
  const { estado, salir, reconectar } = useSesion()
  const router = useRouter()
  const [avisoDeSalida, setAvisoDeSalida] = useState(false)
  const [reconectando, setReconectando] = useState(false)

  if (estado.fase !== "dentro" && estado.fase !== "local") {
    return <SafeAreaView style={estilos.pantalla} />
  }

  const { usuario } = estado
  const enLocal = estado.fase === "local"
  const nombreCompleto = [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ")

  // Antes de salir se mira si hay registros que el servidor aún no tiene: salir
  // borra lo de esta cuenta del móvil, y eso no puede pasar sin avisar.
  const pedirSalida = async (): Promise<void> => {
    const pendientes = await hayPendientes(usuario.id).catch(() => false)
    if (pendientes) {
      setAvisoDeSalida(true)
      return
    }
    await salir()
  }

  return (
    <SafeAreaView style={estilos.pantalla}>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Text style={estilos.marca}>ALPHA &amp; OMEGA</Text>
        <Text style={estilos.lema}>TRAINING</Text>

        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>SESIÓN INICIADA</Text>
          <Text style={estilos.valor}>{nombreCompleto}</Text>
          <Text style={estilos.secundario}>{usuario.email}</Text>
          <Text style={estilos.perfil}>{usuario.rol.toUpperCase()}</Text>
        </View>

        {enLocal && (
          <View style={estilos.avisoLocal} accessibilityLiveRegion="polite">
            <Text style={estilos.textoAvisoLocal}>
              Sin conexión. Puedes seguir registrando las sesiones que ya tenías descargadas; se
              enviará todo cuando vuelva la red.
            </Text>
            <Pulsable
              onPress={() => {
                setReconectando(true)
                void reconectar().finally(() => setReconectando(false))
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={estilos.enlace}>{reconectando ? "PROBANDO…" : "PROBAR CONEXIÓN"}</Text>
            </Pulsable>
          </View>
        )}

        {usuario.rol === "cliente" && (
          <Pulsable
            style={estilos.botonPrincipal}
            onPress={() => {
              router.push("/entrenos")
            }}
            accessibilityRole="button"
          >
            <Text style={estilos.textoPrincipal}>MIS ENTRENOS</Text>
          </Pulsable>
        )}

        {/* Esconder el boton es comodidad, no seguridad: quien entre a la ruta a
            mano se encuentra con el 403 del servidor, que es quien decide. */}
        {!enLocal && usuario.rol === "entrenador" && (
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

        {!enLocal && usuario.rol === "nutricionista" && (
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

        {!enLocal && (
          <Pulsable
            style={estilos.boton}
            onPress={() => {
              router.push("/perfil")
            }}
            accessibilityRole="button"
          >
            <Text style={estilos.textoBoton}>MI PERFIL</Text>
          </Pulsable>
        )}

        {avisoDeSalida ? (
          <View style={estilos.avisoSalida}>
            <Text style={estilos.textoAvisoLocal}>
              Tienes entrenos registrados en este móvil que todavía no se han podido enviar al
              servidor. Si sales ahora se borrarán de este móvil.
            </Text>
            <Pulsable
              style={estilos.botonPeligro}
              onPress={() => void salir()}
              accessibilityRole="button"
            >
              <Text style={estilos.textoPeligro}>SALIR Y DESCARTARLOS</Text>
            </Pulsable>
            <Pulsable
              style={estilos.boton}
              onPress={() => setAvisoDeSalida(false)}
              accessibilityRole="button"
            >
              <Text style={estilos.textoBoton}>CANCELAR</Text>
            </Pulsable>
          </View>
        ) : (
          <Pulsable
            style={estilos.boton}
            onPress={() => void pedirSalida()}
            accessibilityRole="button"
          >
            <Text style={estilos.textoBoton}>CERRAR SESIÓN</Text>
          </Pulsable>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: tema.fondo },
  contenido: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
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
  avisoLocal: {
    alignSelf: "stretch",
    borderColor: tema.oro,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  avisoSalida: {
    alignSelf: "stretch",
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    gap: 4,
  },
  textoAvisoLocal: { color: tema.texto, fontSize: 13, lineHeight: 19 },
  enlace: { color: tema.oro, fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  botonPeligro: {
    alignSelf: "stretch",
    borderColor: tema.error,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  textoPeligro: { color: tema.error, fontSize: 13, fontWeight: "700", letterSpacing: 2 },
})
