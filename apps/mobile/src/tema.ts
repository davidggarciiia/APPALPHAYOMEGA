import { Platform, type ViewStyle } from "react-native"

/**
 * Tema oscuro de Design.html (Alpha & Omega, 24-09-2026).
 *
 * Los nombres se conservan de la versión clara para que todas las pantallas
 * cambien a la vez; lo que cambia es el valor. Contrastes sobre `fondo` y
 * `superficie`: `texto` y `textoTenue` superan 4,5:1; `bordeFuerte` supera 3:1
 * como borde de control; `sobreAcento` sobre el dorado supera 8:1.
 */
export const tema = {
  fondo: "#0E0D0B",
  superficie: "#1A1916",
  /** Día elegido, fila destacada o tarjeta dentro de otra. */
  superficieAlta: "#26231E",
  /** Marco de una imagen o una animación. */
  hundido: "#221F1A",
  /** Campos y opciones: mismo fondo que las tarjetas, con `bordeFuerte`. */
  suave: "#1A1916",
  borde: "#2B2823",
  bordeFuerte: "#7A7366",
  /** Borde dorado de la tarjeta principal de una pantalla. */
  bordeDestacado: "rgba(255,195,76,.28)",
  acento: "#FFC34C",
  boton: "#FFC34C",
  acentoSuave: "#2A2213",
  acentoClaro: "#FFD978",
  sobreAcento: "#16140F",
  /** Ámbar de avisos y valores cambiados. */
  aviso: "#F0B44C",
  /** Naranja de las marcas de sesión en la semana. */
  naranja: "#F28C38",
  cabecera: "#151412",
  campoOscuro: "#1A1916",
  sobreOscuro: "#F2EDE1",
  tenueSobreOscuro: "#A39C8F",
  bordeOscuro: "rgba(255,195,76,.28)",
  texto: "#F2EDE1",
  textoSecundario: "#D9D3C6",
  textoTenue: "#A39C8F",
  marcador: "#948D80",
  exito: "#3DBB6C",
  exitoSuave: "#1F3A29",
  sobreExito: "#06220F",
  error: "#E06A5F",
  fuenteTitulo: "Anton",
  fuenteTexto: "Archivo",
  fuenteSemi: "ArchivoSemiBold",
  fuenteBoton: "ArchivoBold",
} as const

type ConImagen = ViewStyle & { backgroundImage?: string }

// RN 0.86 pinta gradientes con `experimental_backgroundImage`; React Native Web
// usa la propiedad CSS. El color de fondo es la reserva si no hay gradiente.
function conGradiente(color: string, gradiente: string): ConImagen {
  return {
    backgroundColor: color,
    ...(Platform.OS === "web"
      ? { backgroundImage: gradiente }
      : { experimental_backgroundImage: gradiente }),
  }
}

/** Resplandor dorado arriba a la derecha, como en todas las pantallas del diseño. */
const resplandor = "radial-gradient(circle at 85% 0%, #3A2A0C 0%, #0E0D0B 62%)"

export const fondoDeMarca: ConImagen = conGradiente(tema.fondo, resplandor)
export const fondoDeAcceso: ConImagen = conGradiente(tema.fondo, resplandor)

/** Botón principal y opción elegida: dorado en diagonal con texto `sobreAcento`. */
export const degradadoOro: ConImagen = conGradiente(
  tema.boton,
  "linear-gradient(135deg, #FFF09A 0%, #FFCF52 38%, #FFB53C 72%, #E99A1F 100%)",
)

/** Serie hecha o comida marcada: verde en diagonal con texto `sobreExito`. */
export const degradadoExito: ConImagen = conGradiente(
  tema.exito,
  "linear-gradient(135deg, #D2F9C9 0%, #7FE08F 38%, #3DBB6C 72%, #1F8C4E 100%)",
)

/** Marca de una sesión en la semana. */
export const degradadoSesion: ConImagen = conGradiente(
  tema.naranja,
  "radial-gradient(circle at 35% 30%, #FFBE82 0%, #F28C38 55%, #C2611C 100%)",
)
