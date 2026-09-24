import { randomUUID } from "expo-crypto"
import { SesionEnRutinaSchema, type SesionEnRutina } from "@alpha-omega/shared"

export type SerieEditable = {
  id: string
  tipoMedicion: "repeticiones" | "tiempo"
  peso: string
  objetivo: string
}
export type EjercicioEditable = {
  id: string
  ejercicioId: string
  nombre: string
  indicaciones: string
  modoRir?: "desactivado" | "alFinalizarEjercicio" | "cadaSerie"
  tipoCarga?: "conCargaExterna" | "sinCarga"
  calibrar?: boolean
  series: SerieEditable[]
}
export type SesionEditable = {
  id: string
  nombre: string
  diaSemana: number
  ejercicios: EjercicioEditable[]
}

export function nuevaSerie(): SerieEditable {
  return { id: randomUUID(), tipoMedicion: "repeticiones", peso: "", objetivo: "" }
}
export function nuevaSesion(): SesionEditable {
  return { id: randomUUID(), nombre: "", diaSemana: 1, ejercicios: [] }
}
export function desdeSesion(
  sesion: SesionEnRutina,
  nombres: Record<string, string>,
): SesionEditable {
  return {
    ...sesion,
    ejercicios: sesion.ejercicios.map((e) => ({
      ...e,
      nombre: nombres[e.ejercicioId] ?? "Ejercicio",
      indicaciones: e.indicaciones ?? "",
      series: e.series.map((s) => ({
        id: s.id,
        tipoMedicion: s.tipoMedicion,
        peso: s.pesoKg?.toString() ?? "",
        objetivo: String(s.tipoMedicion === "tiempo" ? s.segundos : s.repeticiones),
      })),
    })),
  }
}
export function agregarEjercicio(
  sesion: SesionEditable,
  ejercicio: { id: string; nombre: string },
): SesionEditable {
  return {
    ...sesion,
    ejercicios: [
      ...sesion.ejercicios,
      {
        id: randomUUID(),
        ejercicioId: ejercicio.id,
        nombre: ejercicio.nombre,
        indicaciones: "",
        modoRir: "desactivado",
        tipoCarga: "conCargaExterna",
        calibrar: false,
        series: [nuevaSerie()],
      },
    ],
  }
}
export function moverEjercicio(
  sesion: SesionEditable,
  indice: number,
  desplazamiento: number,
): SesionEditable {
  const destino = indice + desplazamiento
  if (destino < 0 || destino >= sesion.ejercicios.length) return sesion
  const ejercicios = [...sesion.ejercicios]
  const [movido] = ejercicios.splice(indice, 1)
  if (!movido) return sesion
  ejercicios.splice(destino, 0, movido)
  return { ...sesion, ejercicios }
}
export function convertirSesion(sesion: SesionEditable): SesionEnRutina {
  return SesionEnRutinaSchema.parse({
    id: sesion.id,
    nombre: sesion.nombre,
    diaSemana: sesion.diaSemana,
    ejercicios: sesion.ejercicios.map((ejercicio) => ({
      id: ejercicio.id,
      ejercicioId: ejercicio.ejercicioId,
      indicaciones: ejercicio.indicaciones || null,
      ...(ejercicio.modoRir !== undefined && { modoRir: ejercicio.modoRir }),
      ...(ejercicio.tipoCarga !== undefined && { tipoCarga: ejercicio.tipoCarga }),
      ...(ejercicio.calibrar && { calibrar: true }),
      series: ejercicio.series.map((serie) => ({
        id: serie.id,
        tipoMedicion: serie.tipoMedicion,
        pesoKg:
          ejercicio.tipoCarga === "sinCarga" || ejercicio.calibrar || serie.peso.trim() === ""
            ? null
            : Number(serie.peso.replace(",", ".")),
        ...(serie.tipoMedicion === "repeticiones"
          ? { repeticiones: Number(serie.objetivo) }
          : { segundos: Number(serie.objetivo) }),
      })),
    })),
  })
}
