import { useCallback, useMemo, useState } from "react"
import { useFocusEffect, useRouter, type Href } from "expo-router"
import type { Bloque } from "@alpha-omega/shared"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { BotonSecundario, PantallaDeFormulario } from "../src/componentes/formulario"
import { Icono } from "../src/componentes/iconos"
import { SemanaEntrenamiento } from "../src/entrenamiento/semana"
import { NovedadesEntrenamiento } from "../src/entrenamiento/novedades"
import { useAccesoAFiguras } from "../src/catalogo-ejercicios/figura-ejercicio"
import { useCatalogo } from "../src/catalogo-ejercicios/use-catalogo"
import { useEntrenamiento } from "../src/entrenamiento/use-entrenamiento"
import { lunesDeSemana } from "../src/entrenamiento/fechas"
import { HoyInicio } from "../src/nutricion/hoy-inicio"
import { useNutricion } from "../src/nutricion/api"
import { useSeguimiento } from "../src/seguimiento/use-seguimiento"
import { useSesion } from "../src/sesion"
import { tema } from "../src/tema"

export default function Inicio(): React.JSX.Element {
  const { estado, salir } = useSesion()
  const api = useEntrenamiento()
  const catalogo = useCatalogo()
  const accesoFiguras = useAccesoAFiguras()
  const router = useRouter()
  const seguimiento = useSeguimiento()
  const nutricion = useNutricion()
  const [bloque, setBloque] = useState<Bloque | null>(null)
  const clienteId =
    estado.fase === "dentro" && estado.usuario.rol === "cliente" ? estado.usuario.id : null
  // Otros deportes y objetivo de pasos: los fija el entrenador en el bloque.
  useFocusEffect(
    useCallback(() => {
      if (clienteId === null) return
      let vigente = true
      api
        .plan(clienteId, lunesDeSemana())
        .then(({ plan }) => {
          if (vigente) setBloque(plan?.bloque ?? null)
        })
        .catch(() => undefined)
      return () => {
        vigente = false
      }
    }, [api, clienteId]),
  )
  const detalle = useMemo(
    () => ({ leerSesion: api.leerCliente, leerEjercicio: catalogo.leer, acceso: accesoFiguras }),
    [api, catalogo, accesoFiguras],
  )
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
        <View style={s.cliente}>
          <SemanaEntrenamiento
            clienteId={usuario.id}
            api={api}
            copiaLocal
            resumenHoy
            detalle={detalle}
            deportes={bloque?.deportes}
            abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
          />
          <NovedadesEntrenamiento
            clienteId={usuario.id}
            api={api}
            abrir={(id) => router.push({ pathname: "/entrenamiento/[id]", params: { id } })}
          />
          <HoyInicio
            clienteId={usuario.id}
            seguimiento={seguimiento}
            nutricion={nutricion}
            objetivoPasos={bloque?.pasosDiarios ?? null}
          />
        </View>
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
      {usuario.rol !== "cliente" && (
        <BotonSecundario texto="Cerrar sesión" onPress={() => void salir()} />
      )}
    </PantallaDeFormulario>
  )
}
const s = StyleSheet.create({
  cliente: { gap: 32 },
  contenido: { gap: 12 },
  leyenda: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 13, marginBottom: 4 },
  tarjeta: { backgroundColor: tema.superficie, borderRadius: 20, padding: 20, gap: 8 },
  principal: { borderWidth: 1, borderColor: tema.bordeDestacado },
  fila: { flexDirection: "row", gap: 12, alignItems: "center" },
  titulo: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 20, flex: 1 },
  detalle: { color: tema.textoTenue, fontFamily: tema.fuenteTexto, fontSize: 15, lineHeight: 21 },
})
