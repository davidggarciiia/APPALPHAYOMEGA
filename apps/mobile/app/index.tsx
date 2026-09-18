import { useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../src/componentes/formulario"
import { SemanaEntrenamiento } from "../src/entrenamiento/semana"
import { useEntrenamiento } from "../src/entrenamiento/use-entrenamiento"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

export default function Inicio(): React.JSX.Element {
  const { estado, salir } = useSesion()
  const api = useEntrenamiento()
  const router = useRouter()
  if (estado.fase !== "dentro") return <View />
  const { usuario } = estado
  const acceso = (
    titulo: string,
    detalle: string,
    ruta: Href,
    principal = false,
  ): React.JSX.Element => (
    <Pressable
      style={[s.tarjeta, principal && s.principal]}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      onPress={() => router.push(ruta)}
    >
      <View style={s.fila}>
        <Text style={[s.titulo, principal && s.claro]}>{titulo}</Text>
        <Text style={[s.flecha, principal && s.claro]}>↗</Text>
      </View>
      <Text style={[s.detalle, principal && s.detalleClaro]}>{detalle}</Text>
    </Pressable>
  )
  return (
    <PantallaDeFormulario sinTarjeta>
      {usuario.rol === "cliente" ? (
        <SemanaEntrenamiento
          clienteId={usuario.id}
          api={api}
          copiaLocal
          resumenHoy
          abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
        />
      ) : (
        <View style={s.contenido}>
          <Text style={s.leyenda}>TU ESPACIO DE TRABAJO</Text>
          {usuario.rol === "entrenador" && (
            <>
              {acceso(
                "Mis clientes",
                "Organiza sus semanas y revisa los entrenamientos enviados.",
                "/cartera",
                true,
              )}
              {acceso(
                "Mis rutinas",
                "Prepara tus sesiones y adáptalas a cada cliente.",
                "/rutinas",
              )}
              {acceso("Ejercicios", "Gestiona los ejercicios de tu catálogo.", "/catalogo")}
              {acceso(
                "Nutricionista",
                "Gestiona el acceso de tu profesional de nutrición.",
                "/nutricionista",
              )}
            </>
          )}
          {usuario.rol === "nutricionista" &&
            acceso(
              "Mis clientes",
              "Consulta las fichas de los clientes asignados.",
              "/mis-clientes",
              true,
            )}
          {acceso("Mi perfil", "Consulta y actualiza tus datos personales.", "/perfil")}
        </View>
      )}
      <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
    </PantallaDeFormulario>
  )
}
const s = StyleSheet.create({
  contenido: { gap: 14 },
  leyenda: {
    color: tema.textoTenue,
    fontFamily: tema.fuenteTexto,
    fontSize: 11,
    letterSpacing: 1.2,
    marginVertical: 6,
  },
  tarjeta: {
    backgroundColor: tema.superficie,
    borderColor: tema.borde,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    gap: 10,
  },
  principal: { backgroundColor: tema.acento, borderColor: tema.acento, paddingVertical: 28 },
  fila: { flexDirection: "row", gap: 12, alignItems: "center" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteTitulo, fontSize: 32, flex: 1 },
  flecha: { color: tema.texto, fontSize: 28 },
  claro: { color: tema.sobreAcento },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
  detalleClaro: { color: "#DADADA" },
})
