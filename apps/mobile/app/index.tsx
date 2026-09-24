import { useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../src/componentes/formulario"
import { Icono } from "../src/componentes/iconos"
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
        <Text style={s.titulo}>{titulo}</Text>
        <Icono nombre="adelante" color={principal ? tema.acento : tema.textoTenue} />
      </View>
      <Text style={s.detalle}>{detalle}</Text>
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
          <Text style={s.leyenda}>Tu espacio de trabajo</Text>
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
  contenido: { gap: 12 },
  leyenda: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13, marginBottom: 4 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 20, gap: 8 },
  principal: { borderWidth: 1, borderColor: tema.bordeDestacado },
  fila: { flexDirection: "row", gap: 12, alignItems: "center" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20, flex: 1 },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
})
