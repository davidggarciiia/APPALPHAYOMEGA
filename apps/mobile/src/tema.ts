/**
 * Identidad visual de Alpha & Omega Training.
 *
 * Paleta, tipografía y degradados del export de Claude Design
 * (`docs/diseno/pantallas/`): casi negro cálido, oro y un verde para lo hecho.
 * Las claves de siempre conservan su papel, así las pantallas existentes
 * heredan la paleta sin tocarlas.
 */
export const tema = {
  fondo: "#0E0D0B",
  /** Tarjetas y campos. */
  superficie: "#1A1916",
  /** Botones de icono, filas activas y campos dentro de una tarjeta. */
  superficieAlta: "#26231E",
  /** Barra inferior y cabeceras fijas. */
  superficieBaja: "#151412",
  borde: "#2B2823",
  /** Borde fino dorado de la tarjeta principal. */
  bordeOro: "rgba(255, 195, 76, 0.22)",
  /** Aro de un marcador sin marcar. */
  aro: "#3A362F",
  oro: "#FFC34C",
  oroSuave: "#FFD978",
  texto: "#F2EDE1",
  textoTenue: "#A39C8F",
  /** Objetivo tenue dentro de un campo vacío. */
  marcador: "#948D80",
  /** Texto sobre un botón dorado. */
  sobreOro: "#16140F",
  verde: "#3DBB6C",
  verdeClaro: "#7FE08F",
  sobreVerde: "#06220F",
  error: "#F07167",
} as const

/** Degradados a 135°, como en el diseño. */
export const degradados = {
  oro: ["#FFF09A", "#FFCF52", "#FFB53C", "#E99A1F"],
  verde: ["#D2F9C9", "#7FE08F", "#3DBB6C", "#1F8C4E"],
  paradas: [0, 0.38, 0.72, 1],
} as const

/**
 * Anton para los títulos en mayúsculas; Archivo para todo lo demás. Cada peso
 * es su propia familia: en Android `fontWeight` no elige el fichero.
 */
export const fuentes = {
  titulo: "Anton_400Regular",
  normal: "Archivo_400Regular",
  media: "Archivo_500Medium",
  semi: "Archivo_600SemiBold",
  negrita: "Archivo_700Bold",
} as const
