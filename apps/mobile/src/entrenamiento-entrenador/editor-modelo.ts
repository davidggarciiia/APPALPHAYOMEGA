import { randomUUID } from "expo-crypto"
import {
  SesionEnRutinaSchema,
  type SeriePrescrita,
  type SeriePrescritaDistancia,
  type SesionEnRutina,
} from "@alpha-omega/shared"

/**
 * D01 · Los modelos profesionales representan la distancia aunque el contrato
 * público no la acepte hasta D01.g: convertirSesion valida con
 * SesionEnRutinaSchema, que decide si una serie en metros se puede publicar.
 */
export type SerieConDistancia = SeriePrescrita | SeriePrescritaDistancia
export type TipoMedicion = SerieConDistancia["tipoMedicion"]
type EjercicioConDistancia = Omit<SesionEnRutina["ejercicios"][number], "series"> & {
  series: SerieConDistancia[]
}
export type SesionConDistancia = Omit<SesionEnRutina, "ejercicios"> & {
  ejercicios: EjercicioConDistancia[]
}

export type SerieEditable = {
  id: string
  tipoMedicion: TipoMedicion
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
/** «rep», «s» o «m»: la unidad que acompaña al objetivo. */
export function unidadCorta(tipo: TipoMedicion): string {
  switch (tipo) {
    case "repeticiones":
      return "rep"
    case "tiempo":
      return "s"
    case "distancia":
      return "m"
  }
}

/** El objetivo en su propia unidad; nunca se convierte a otra. */
function cantidadPrescrita(serie: SerieConDistancia): number {
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return serie.repeticiones
    case "tiempo":
      return serie.segundos
    case "distancia":
      return serie.metros
  }
}

/** Serie guardada → editable, con su id, su unidad y su carga. */
export function desdeSerie(serie: SerieConDistancia): SerieEditable {
  return {
    id: serie.id,
    tipoMedicion: serie.tipoMedicion,
    peso: serie.pesoKg?.toString() ?? "",
    objetivo: String(cantidadPrescrita(serie)),
  }
}

/** Serie editable → documento sin validar, con los kilos que admite el ejercicio. */
export function convertirSerie(
  serie: SerieEditable,
  ejercicio: Pick<EjercicioEditable, "tipoCarga" | "calibrar">,
): SerieConDistancia {
  const pesoKg =
    ejercicio.tipoCarga === "sinCarga" || ejercicio.calibrar || serie.peso.trim() === ""
      ? null
      : Number(serie.peso.replace(",", "."))
  const cantidad = Number(serie.objetivo)
  switch (serie.tipoMedicion) {
    case "repeticiones":
      return { id: serie.id, tipoMedicion: "repeticiones", pesoKg, repeticiones: cantidad }
    case "tiempo":
      return { id: serie.id, tipoMedicion: "tiempo", pesoKg, segundos: cantidad }
    case "distancia":
      return { id: serie.id, tipoMedicion: "distancia", pesoKg, metros: cantidad }
  }
}

export function desdeSesion(
  sesion: SesionConDistancia,
  nombres: Record<string, string>,
): SesionEditable {
  return {
    ...sesion,
    ejercicios: sesion.ejercicios.map((e) => ({
      ...e,
      nombre: nombres[e.ejercicioId] ?? "Ejercicio",
      indicaciones: e.indicaciones ?? "",
      series: e.series.map(desdeSerie),
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
      series: ejercicio.series.map((serie) => convertirSerie(serie, ejercicio)),
    })),
  })
}
