import type { ReactNode } from "react"
import { usePathname, useRouter, type Href } from "expo-router"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useSesion } from "../sesion"
import { tema } from "../tema"

type Destino = { ruta: Href; nombre: string; icono: string }
const entrenador: Destino[] = [
  { ruta: "/cartera", nombre: "Clientes", icono: "◎" },
  { ruta: "/rutinas", nombre: "Rutinas", icono: "▤" },
  { ruta: "/catalogo", nombre: "Ejercicios", icono: "◫" },
]
const cliente: Destino[] = [
  { ruta: "/", nombre: "Inicio", icono: "⌂" },
  { ruta: "/entrenamiento", nombre: "Entrenos", icono: "▦" },
  { ruta: "/perfil", nombre: "Perfil", icono: "◎" },
]
const titulos: Record<string, string> = {
  cartera: "Mis clientes",
  rutinas: "Mis rutinas",
  catalogo: "Ejercicios",
  entrenamiento: "Entrenamiento",
  entrenador: "Plan de entrenamiento",
  cliente: "Ficha de cliente",
  perfil: "Mi perfil",
  nutricionista: "Nutricionista",
  "mis-clientes": "Mis clientes",
}

/** Cabecera y destinos reales del perfil, sin pestañas para módulos pendientes. */
export function Armazon({ children }: { children: ReactNode }): React.JSX.Element {
  const { estado } = useSesion()
  const ruta = usePathname()
  const router = useRouter()
  if (!("usuario" in estado)) return <>{children}</>
  const { usuario } = estado
  const principal = ruta.split("/").filter(Boolean)[0] ?? ""
  const destinos: Destino[] =
    estado.fase === "local"
      ? cliente.slice(1, 2)
      : usuario.rol === "entrenador"
        ? entrenador
        : usuario.rol === "cliente"
          ? cliente
          : ([
              { ruta: "/", nombre: "Inicio", icono: "⌂" },
              ...(usuario.rol === "nutricionista"
                ? [{ ruta: "/mis-clientes" as const, nombre: "Clientes", icono: "▤" }]
                : []),
              { ruta: "/perfil", nombre: "Perfil", icono: "◎" },
            ] satisfies Destino[])
  const mostrarPie = [
    "/",
    "/cartera",
    "/rutinas",
    "/catalogo",
    "/entrenamiento",
    "/perfil",
    "/mis-clientes",
  ].includes(ruta)
  return (
    <View style={s.raiz}>
      <SafeAreaView edges={["top", "left", "right"]} style={s.fondo}>
        <View style={s.cabecera}>
          <View style={s.titulos}>
            <Text style={s.rol}>
              {principal === ""
                ? `Hola, ${usuario.nombre.split(" ")[0]}`
                : "Alpha & Omega Training"}
              {estado.fase === "local" ? " · Sin conexión" : ""}
            </Text>
            <Text accessibilityRole="header" style={s.titulo}>
              {titulos[principal] ??
                (usuario.rol === "cliente" ? "Tu entrenamiento" : "Tu espacio")}
            </Text>
          </View>
          {estado.fase === "dentro" && (
            <Pressable
              style={s.avatar}
              accessibilityRole="button"
              accessibilityLabel="Abrir mi perfil"
              onPress={() => router.push("/perfil")}
            >
              <Text style={s.inicial}>{usuario.nombre.slice(0, 1).toUpperCase()}</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
      <View style={s.contenido}>{children}</View>
      <SafeAreaView edges={["bottom", "left", "right"]} style={mostrarPie ? s.pie : s.fondo}>
        {mostrarPie && (
          <View style={s.navegacion}>
            {destinos.map((d) => {
              const activa = ruta === d.ruta
              return (
                <Pressable
                  key={String(d.ruta)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  accessibilityLabel={d.nombre}
                  onPress={() => router.replace(d.ruta)}
                  style={s.destino}
                >
                  <View style={s.iconoMarco}>
                    <Text style={[s.icono, activa && s.iconoActivo]}>{d.icono}</Text>
                  </View>
                  <Text style={[s.etiqueta, activa && s.etiquetaActiva]}>{d.nombre}</Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}
const s = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: tema.fondo },
  cabecera: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  titulos: { flex: 1 },
  rol: { color: tema.textoTenue, fontSize: 13, fontFamily: tema.fuenteTexto },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 32,
    lineHeight: 36,
    textTransform: "uppercase",
  },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: tema.borde,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: tema.borde,
  },
  inicial: { color: tema.texto, fontFamily: tema.fuenteBoton, fontSize: 18 },
  contenido: { flex: 1, minHeight: 0, width: "100%", maxWidth: 820, alignSelf: "center" },
  pie: { backgroundColor: tema.superficie, borderTopColor: tema.borde, borderTopWidth: 1 },
  fondo: { backgroundColor: tema.fondo },
  navegacion: {
    flexDirection: "row",
    maxWidth: 820,
    width: "100%",
    alignSelf: "center",
    paddingVertical: 8,
  },
  destino: { flex: 1, alignItems: "center", gap: 4, minHeight: 52 },
  iconoMarco: {
    width: 48,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  icono: { fontSize: 23, lineHeight: 26, color: tema.textoTenue },
  iconoActivo: { color: tema.texto, fontWeight: "800" },
  etiqueta: { fontSize: 11, color: tema.textoTenue, fontFamily: tema.fuenteTexto },
  etiquetaActiva: { color: tema.texto, fontFamily: tema.fuenteBoton },
})
