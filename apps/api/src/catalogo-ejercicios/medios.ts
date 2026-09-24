/**
 * Índice de las figuras animadas gratuitas que la app puede usar
 * (docs/animaciones-ejercicios.md, decisión del 2026-09-24).
 *
 * Aquí solo viven nuestros identificadores, nombres en español y la licencia de
 * cada clip. Los MP4 no entran en el repositorio: el EULA de Vital prohíbe
 * redistribuir los originales. `importar-medios.ts` los transcodifica desde los
 * paquetes descargados a MEDIOS_DIR, que el servidor sirve tras comprobar el rol.
 */
export type MedioDelIndice = {
  id: string
  nombre: string
  fuente: "vital" | "movekit"
  /** Nombre del archivo dentro del paquete gratuito del proveedor. */
  archivoOrigen: string
  licencia: string
  /** La licencia permite guardar copia en el dispositivo. */
  sinConexion: boolean
  /** Cambia si se sustituye el archivo, para invalidar las cachés del móvil. */
  version: string
}

const LICENCIA_VITAL = "Vital Animations EULA 2026.1 · paquete gratuito"
const LICENCIA_MOVEKIT = "MoveKit License Agreement v1.0 · muestra gratuita"

const VITAL: ReadonlyArray<[string, string]> = [
  ["0051", "Aperturas en máquina contractora"],
  ["0052", "Press Svend"],
  ["0053", "Sprint en bicicleta de aire"],
  ["0054", "Sentadilla trasera con barra"],
  ["0055", "Sentadilla búlgara con barra"],
  ["0056", "Sentadilla frontal con barra"],
  ["0057", "Hip thrust con barra"],
  ["0058", "Marcha con barra"],
  ["0059", "Zancadas atrás con barra"],
  ["0060", "Peso muerto rumano con barra"],
  ["0061", "Patada de glúteo en polea"],
  ["0062", "Bicicleta estática"],
  ["0063", "Sentadilla búlgara con mancuernas"],
  ["0064", "Sentadilla goblet con mancuerna"],
  ["0065", "Bisagra de cadera con mancuernas"],
  ["0066", "Sentadilla con salto y mancuernas"],
  ["0067", "Elíptica en intervalos"],
  ["0068", "Sentadilla hack en máquina"],
  ["0069", "Abducción de cadera en máquina"],
  ["0070", "Marcha con kettlebell"],
  ["0071", "Levantamiento de kettlebell"],
  ["0072", "Swing con kettlebell"],
  ["0073", "Extensión de cuádriceps en máquina"],
  ["0074", "Prensa de piernas"],
  ["0075", "Curl femoral tumbado en máquina"],
  ["0076", "Ondas con cuerda"],
  ["0077", "Remo en ergómetro"],
  ["0078", "Correr en cinta"],
  ["0079", "Curl femoral sentado en máquina"],
  ["0080", "Press de hombros sentado en máquina"],
  ["0081", "Subidas al cajón con peso"],
  ["0082", "Escaladora (variante)"],
  ["0083", "Escaladora"],
  ["0084", "Peso muerto con piernas rígidas en máquina"],
  ["0085", "Extensión de tríceps en polea con cuerda"],
  ["0086", "Caminar en cinta"],
  ["0087", "Press Arnold con mancuernas"],
  ["0088", "Press militar de pie con barra"],
  ["0089", "Remo al mentón con barra"],
  ["0090", "Press de hombros con mancuernas"],
  ["0091", "Remo al mentón con mancuernas"],
  ["0092", "Elevación frontal con mancuerna"],
  ["0093", "Elevación frontal con disco"],
  ["0094", "Press de hombros con kettlebell"],
  ["0095", "Elevación lateral cruzada en polea"],
  ["0096", "Elevaciones laterales con mancuernas"],
  ["0097", "Elevación lateral en máquina"],
  ["0098", "Press militar sentado en multipower"],
  ["0099", "Pájaros en máquina contractora"],
  ["0100", "Pájaros en polea"],
]

export const MEDIOS: readonly MedioDelIndice[] = [
  ...VITAL.map(([numero, nombre]) => ({
    id: `vital-${numero}`,
    nombre,
    fuente: "vital" as const,
    archivoOrigen: `${numero}.mp4`,
    licencia: LICENCIA_VITAL,
    sinConexion: true,
    version: "1",
  })),
  {
    id: "movekit-pull-ups",
    nombre: "Dominadas",
    fuente: "movekit",
    archivoOrigen: "pull-ups.mp4",
    licencia: LICENCIA_MOVEKIT,
    // La licencia de MoveKit no menciona copias en el dispositivo: solo streaming.
    sinConexion: false,
    version: "1",
  },
  {
    id: "movekit-dumbbell-chest-fly",
    nombre: "Aperturas con mancuernas",
    fuente: "movekit",
    archivoOrigen: "dumbbell-chest-fly.mp4",
    licencia: LICENCIA_MOVEKIT,
    sinConexion: false,
    version: "1",
  },
]

export function medioDelIndice(id: string): MedioDelIndice | undefined {
  return MEDIOS.find((medio) => medio.id === id)
}
