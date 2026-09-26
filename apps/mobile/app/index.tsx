import { useRouter } from "expo-router"
import { ScrollView, StyleSheet, Text, View } from "react-native"

import { FilaDeLista, Lista, Pantalla, texto } from "../src/componentes/diseno"
import { AvisoSinConexion, Saludo, SeccionCuenta } from "../src/componentes/inicio-comun"
import { InicioDelCliente } from "../src/entrenamiento-cliente/inicio"
import { useSesion } from "../src/sesion"

/**
 * El inicio de cada perfil. El cliente ve su entreno de hoy y su semana; el
 * resto, las herramientas de su trabajo.
 *
 * Esconder una entrada es comodidad, no seguridad: quien entre a la ruta a mano
 * se encuentra con el 403 del servidor, que es quien decide.
 */
export default function Inicio(): React.JSX.Element {
  const { estado } = useSesion()
  if (estado.fase !== "dentro" && estado.fase !== "local") {
    return <Pantalla>{null}</Pantalla>
  }
  return estado.usuario.rol === "cliente" ? <InicioDelCliente /> : <InicioDelEquipo />
}

type Entrada = {
  titulo: string
  subtitulo: string
  ruta: "/cartera" | "/nutricionista" | "/mis-clientes"
}

function InicioDelEquipo(): React.JSX.Element {
  const { estado } = useSesion()
  const router = useRouter()
  const rol = estado.fase === "dentro" ? estado.usuario.rol : null

  const entradas: Entrada[] =
    rol === "entrenador"
      ? [
          { titulo: "Mi cartera", subtitulo: "Clientes, fichas y accesos", ruta: "/cartera" },
          {
            titulo: "Nutricionista",
            subtitulo: "Quién lleva la nutrición",
            ruta: "/nutricionista",
          },
        ]
      : rol === "nutricionista"
        ? [{ titulo: "Mis clientes", subtitulo: "Los clientes que llevas", ruta: "/mis-clientes" }]
        : []

  return (
    <Pantalla>
      <ScrollView contentContainerStyle={estilos.contenido}>
        <Saludo />
        <AvisoSinConexion />
        {entradas.length > 0 && (
          <View style={estilos.seccion}>
            <Text style={texto.seccion}>Tu trabajo</Text>
            <Lista>
              {entradas.map((entrada, indice) => (
                <FilaDeLista
                  key={entrada.ruta}
                  titulo={entrada.titulo}
                  subtitulo={entrada.subtitulo}
                  onPress={() => router.push(entrada.ruta)}
                  ultima={indice === entradas.length - 1}
                />
              ))}
            </Lista>
          </View>
        )}
        <SeccionCuenta />
      </ScrollView>
    </Pantalla>
  )
}

const estilos = StyleSheet.create({
  contenido: { padding: 20, paddingBottom: 48, gap: 32 },
  seccion: { gap: 14 },
})
