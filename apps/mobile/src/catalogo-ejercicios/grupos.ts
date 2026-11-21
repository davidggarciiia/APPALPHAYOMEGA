import type { GrupoMuscular } from "@alpha-omega/shared"

/**
 * Cómo se lee cada grupo. El vocabulario viaja sin acentos y aquí se escribe
 * bien. Al ser un `Record`, añadir un grupo al contrato no compila sin su nombre.
 */
export const ETIQUETA_DE_GRUPO: Record<GrupoMuscular, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  antebrazos: "Antebrazos",
  abdomen: "Abdomen",
  gluteos: "Glúteos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  gemelos: "Gemelos",
}
