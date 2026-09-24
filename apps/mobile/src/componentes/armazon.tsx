import type { ReactNode } from "react"
import { usePathname, useRouter, type Href } from "expo-router"
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import emblema from "../../assets/emblema.png"
import logotipo from "../../assets/logotipo.png"
import { useSesion } from "../sesion"
import { fondoDeMarca, tema } from "../tema"
import { Icono, type NombreIcono } from "./iconos"

type Destino = { ruta: Href; nombre: string; icono: NombreIcono }
const entrenador: Destino[] = [
  { ruta: "/cartera", nombre: "Clientes", icono: "clientes" },
  { ruta: "/rutinas", nombre: "Rutinas", icono: "plan" },
  { ruta: "/catalogo", nombre: "Ejercicios", icono: "ejercicios" },
]
/** Como en el diseño: Entreno (hoy), Plan, Nutrición y Progreso. La cuenta, en el avatar. */
const cliente: Destino[] = [
  { ruta: "/", nombre: "Entreno", icono: "entreno" },
  { ruta: "/entrenamiento", nombre: "Plan", icono: "plan" },
  { ruta: "/nutricion", nombre: "Nutrición", icono: "nutricion" },
  { ruta: "/progreso", nombre: "Progreso", icono: "progreso" },
]
const titulos: Record<string, string> = {
  cartera: "Mis clientes",
  rutinas: "Mis rutinas",
  catalogo: "Ejercicios",
  entrenamiento: "Tu plan",
  nutricion: "Nutrición",
  entrenador: "Plan de entrenamiento",
  cliente: "Ficha de cliente",
  perfil: "Mi perfil",
  progreso: "Progreso",
  nutricionista: "Nutricionista",
  "mis-clientes": "Mis clientes",
}
const PRINCIPALES = [
  "/",
  "/cartera",
  "/rutinas",
  "/catalogo",
  "/entrenamiento",
  "/nutricion",
  "/perfil",
  "/progreso",
  "/mis-clientes",
]
/** Desde este ancho el profesional trabaja con barra lateral, como en el diseño de escritorio. */
const ANCHO_ESCRITORIO = 1024

/** Cabecera y destinos reales del perfil, sin pestañas para módulos pendientes. */
export function Armazon({ children }: { children: ReactNode }): React.JSX.Element {
  const { estado } = useSesion()
  const ruta = usePathname()
  const router = useRouter()
  const { width } = useWindowDimensions()
  if (!("usuario" in estado)) return <>{children}</>
  const { usuario } = estado
  const principal = ruta.split("/").filter(Boolean)[0] ?? ""
  const esCliente = usuario.rol === "cliente"
  const destinos: Destino[] =
    estado.fase === "local"
      ? cliente.slice(1, 3)
      : usuario.rol === "entrenador"
        ? entrenador
        : esCliente
          ? cliente
          : ([
              { ruta: "/", nombre: "Inicio", icono: "inicio" },
              ...(usuario.rol === "nutricionista"
                ? [
                    {
                      ruta: "/mis-clientes" as const,
                      nombre: "Clientes",
                      icono: "clientes" as const,
                    },
                  ]
                : []),
              { ruta: "/perfil", nombre: "Perfil", icono: "perfil" },
            ] satisfies Destino[])
  const enPrincipal = PRINCIPALES.includes(ruta)
  // A pantalla completa, con su propio botón de volver: la sesión y cada comida.
  const sesionCompleta = esCliente && /^\/(entrenamiento\/[^/]+|nutricion\/comida)$/.test(ruta)
  const titulo =
    principal === "" && esCliente
      ? `Hola, ${usuario.nombre.split(" ")[0] ?? ""}`
      : (titulos[principal] ?? (esCliente ? "Tu entrenamiento" : "Tu espacio"))
  const iniciales = usuario.nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.slice(0, 1).toUpperCase())
    .join("")
  const avatar =
    estado.fase === "dentro" ? (
      <Pressable
        style={s.avatar}
        accessibilityRole="button"
        accessibilityLabel={`${iniciales}, tu perfil`}
        onPress={() => router.push("/perfil")}
      >
        <Text style={s.iniciales}>{iniciales}</Text>
      </Pressable>
    ) : null
  const atras =
    !enPrincipal && router.canGoBack() ? (
      <Pressable
        style={s.atras}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={() => router.back()}
      >
        <Icono nombre="atras" color={tema.texto} />
      </Pressable>
    ) : null
  const sinConexion =
    estado.fase === "local" ? <Text style={s.aviso}>Sin conexión · copia guardada</Text> : null

  if (!esCliente && width >= ANCHO_ESCRITORIO) {
    const lateral: Destino[] = [
      { ruta: "/", nombre: "Hoy", icono: "inicio" },
      ...destinos.filter((d) => d.ruta !== "/" && d.ruta !== "/perfil"),
      ...(usuario.rol === "entrenador"
        ? [
            {
              ruta: "/nutricionista" as const,
              nombre: "Nutricionista",
              icono: "nutricion" as const,
            },
          ]
        : []),
    ]
    return (
      <View style={[s.raiz, s.escritorio]}>
        <SafeAreaView edges={["top", "bottom", "left"]} style={s.lateral}>
          <Image
            source={logotipo}
            style={s.logotipo}
            accessibilityRole="image"
            accessibilityLabel="Alpha & Omega Training"
          />
          <View style={s.menu} accessibilityRole="tablist">
            {lateral.map((d) => {
              const activa = ruta === d.ruta || `/${principal}` === d.ruta
              return (
                <Pressable
                  key={String(d.ruta)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  accessibilityLabel={d.nombre}
                  onPress={() => router.replace(d.ruta)}
                  style={[s.opcionMenu, activa && s.opcionMenuActiva]}
                >
                  <Text style={[s.textoMenu, activa && s.textoMenuActivo]}>{d.nombre}</Text>
                </Pressable>
              )
            })}
          </View>
          <Pressable
            style={[s.opcionMenu, s.cuenta, principal === "perfil" && s.opcionMenuActiva]}
            accessibilityRole="button"
            accessibilityLabel="Mi cuenta"
            onPress={() => router.replace("/perfil")}
          >
            <Text style={[s.textoMenu, principal === "perfil" && s.textoMenuActivo]}>
              Mi cuenta
            </Text>
          </Pressable>
        </SafeAreaView>
        <SafeAreaView edges={["top", "right"]} style={s.principalEscritorio}>
          <View style={[s.cabecera, s.cabeceraEscritorio]}>
            <View style={s.fila}>
              {atras}
              <View style={s.titulos}>
                <Text accessibilityRole="header" style={s.titulo}>
                  {titulo}
                </Text>
              </View>
            </View>
          </View>
          <View style={s.contenido}>{children}</View>
        </SafeAreaView>
      </View>
    )
  }

  return (
    <View style={s.raiz}>
      <SafeAreaView edges={["top", "left", "right"]} style={s.transparente}>
        {!sesionCompleta &&
          (principal === "" && esCliente ? (
            <View style={s.cabecera}>
              <View style={s.fila}>
                <Image
                  source={emblema}
                  style={s.emblema}
                  accessibilityRole="image"
                  accessibilityLabel="Alpha & Omega Training"
                />
                {avatar}
              </View>
              <Text accessibilityRole="header" style={s.titulo}>
                {titulo}
              </Text>
              {sinConexion}
            </View>
          ) : (
            <View style={s.cabecera}>
              <View style={s.fila}>
                {atras}
                <View style={s.titulos}>
                  <Text accessibilityRole="header" style={s.titulo} numberOfLines={2}>
                    {titulo}
                  </Text>
                  {sinConexion}
                </View>
                {avatar}
              </View>
            </View>
          ))}
      </SafeAreaView>
      <View style={s.contenido}>{children}</View>
      <SafeAreaView
        edges={["bottom", "left", "right"]}
        style={enPrincipal ? s.pie : s.transparente}
      >
        {enPrincipal && (
          <View style={s.navegacion} accessibilityRole="tablist">
            {destinos.map((d) => {
              const activa = ruta === d.ruta
              const color = activa ? tema.acento : tema.textoTenue
              return (
                <Pressable
                  key={String(d.ruta)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  accessibilityLabel={d.nombre}
                  onPress={() => router.replace(d.ruta)}
                  style={s.destino}
                >
                  <Icono nombre={d.icono} color={color} />
                  <Text style={[s.etiqueta, { color }]}>{d.nombre}</Text>
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
  raiz: { flex: 1, ...fondoDeMarca },
  escritorio: { flexDirection: "row" },
  transparente: { backgroundColor: "transparent" },
  cabecera: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  cabeceraEscritorio: { paddingTop: 36 },
  fila: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  titulos: { flex: 1, gap: 6 },
  emblema: { width: 31, height: 48, resizeMode: "contain" },
  titulo: {
    color: tema.texto,
    fontFamily: tema.fuenteTitulo,
    fontSize: 34,
    lineHeight: 38,
    textTransform: "uppercase",
  },
  aviso: { color: tema.aviso, fontFamily: tema.fuenteSemi, fontSize: 13 },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: tema.superficie,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iniciales: { color: tema.acento, fontFamily: tema.fuenteBoton, fontSize: 15 },
  atras: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: tema.superficie,
    alignItems: "center",
    justifyContent: "center",
  },
  contenido: { flex: 1, minHeight: 0, width: "100%", maxWidth: 820, alignSelf: "center" },
  pie: { backgroundColor: tema.cabecera, borderTopColor: tema.borde, borderTopWidth: 1 },
  navegacion: {
    flexDirection: "row",
    maxWidth: 820,
    width: "100%",
    alignSelf: "center",
    minHeight: 68,
  },
  destino: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, minHeight: 60 },
  etiqueta: { fontSize: 11, fontFamily: tema.fuenteSemi },
  lateral: {
    width: 232,
    backgroundColor: tema.cabecera,
    borderRightColor: tema.borde,
    borderRightWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 20,
    gap: 32,
  },
  logotipo: { width: 168, height: 59, resizeMode: "contain", marginHorizontal: 12 },
  menu: { gap: 2 },
  opcionMenu: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, justifyContent: "center" },
  opcionMenuActiva: { backgroundColor: tema.superficieAlta },
  textoMenu: { color: tema.textoTenue, fontFamily: tema.fuenteSemi, fontSize: 15 },
  textoMenuActivo: { color: tema.texto, fontFamily: tema.fuenteBoton },
  cuenta: { marginTop: "auto" },
  principalEscritorio: { flex: 1, minWidth: 0 },
})
