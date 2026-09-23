import { Platform, type ViewStyle } from "react-native"

/** Colores del tema claro de Alpha Omega App v2.dc.html. */
export const tema = {
  fondo: "#F7F4EE",
  superficie: "#FFFFFF",
  suave: "#F1ECE2",
  borde: "#E6DFD0",
  bordeFuerte: "#D9D1C0",
  acento: "#8F6717",
  boton: "#B8862B",
  acentoSuave: "#F6ECD6",
  acentoClaro: "#F2D17B",
  sobreAcento: "#FFFFFF",
  cabecera: "#0B0A08",
  campoOscuro: "#211D15",
  sobreOscuro: "#F8F3E7",
  tenueSobreOscuro: "#B7AB94",
  bordeOscuro: "rgba(242,209,123,.35)",
  texto: "#171512",
  textoSecundario: "#4D4739",
  textoTenue: "#6F6858",
  exito: "#2F7D4A",
  exitoSuave: "#E8F3EA",
  error: "#5C4410",
  fuenteTitulo: "BarlowCondensed",
  fuenteTexto: "Barlow",
  fuenteBoton: "BarlowBold",
} as const

const luz =
  "radial-gradient(circle at 78% 16%,rgba(184,134,43,.30),transparent 42%),radial-gradient(circle at 12% 78%,rgba(184,134,43,.30),transparent 40%)"
const luzAcceso = "radial-gradient(circle at 50% 20%,rgba(216,162,58,.25),transparent 40%)"

// RN 0.86 procesa gradientes radiales; React Native Web usa la propiedad CSS.
export const fondoDeMarca: ViewStyle & { backgroundImage?: string } = {
  backgroundColor: tema.fondo,
  ...(Platform.OS === "web" ? { backgroundImage: luz } : { experimental_backgroundImage: luz }),
}
export const fondoDeAcceso: ViewStyle & { backgroundImage?: string } = {
  backgroundColor: tema.cabecera,
  ...(Platform.OS === "web"
    ? { backgroundImage: luzAcceso }
    : { experimental_backgroundImage: luzAcceso }),
}
