import {
  estimar1RM,
  mejorSerieDeSemana,
  type EjercicioPrescrito,
  type ListadoResultados,
  type ProgresionFuerza,
  type SerieRegistrada,
  type SerieRegistradaRepeticiones,
  type SesionDeProgresion,
} from "@alpha-omega/shared"
import { lunesDeSemana } from "../../entrenamiento/fechas"
import { objetivoDeSerie, textoRir } from "../../entrenamiento/sesion/modelo"

export type SesionDelEjercicio = {
  sesionId: string
  fecha: string
  enviadoEn: string
  ejercicio: EjercicioPrescrito
  series: SerieRegistrada[]
  rirPorSerie: Record<string, EjercicioPrescrito["rir"]>
}

export function historialDelEjercicio(
  resultados: ListadoResultados["resultados"],
  ejercicioId: string,
): SesionDelEjercicio[] {
  return resultados
    .flatMap(({ agenda, resultado }) => {
      const ejercicios = resultado.prescripcion.ejercicios.filter(
        (e) => e.ejercicioId === ejercicioId,
      )
      if (!ejercicios[0]) return []
      const hechas = new Map(resultado.series.map((s) => [s.serieId, s]))
      return [
        {
          sesionId: resultado.sesionId,
          fecha: agenda.fechaActual,
          enviadoEn: resultado.enviadoEn,
          ejercicio:
            ejercicios.find((e) => (e.seccion ?? "principal") === "principal") ?? ejercicios[0],
          rirPorSerie: Object.fromEntries(
            ejercicios.flatMap((e) => e.series.map((s) => [s.id, e.rir])),
          ),
          series: ejercicios.flatMap((e) =>
            e.series.map((prescrita): SerieRegistrada => {
              const serie = hechas.get(prescrita.id)
              return serie?.hecha
                ? { ...serie.valores, serieId: serie.serieId, hecha: true }
                : {
                    ...prescrita,
                    serieId: prescrita.id,
                    hecha: false,
                    ...(serie?.omitida && { omitida: true }),
                  }
            }),
          ),
        },
      ]
    })
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.enviadoEn.localeCompare(a.enviadoEn))
}

export type SemanaDeFuerza = {
  semana: string
  fecha: string
  serie: SerieRegistradaRepeticiones
  estimado: number
}

export function conRirDelHistorial(
  semana: SemanaDeFuerza | undefined,
  historial: SesionDelEjercicio[],
): SerieRegistradaRepeticiones | null {
  if (!semana) return null
  const encontrada = historial
    .filter((s) => s.fecha === semana.fecha)
    .flatMap((s) => s.series)
    .find(
      (s) =>
        s.hecha &&
        s.tipoMedicion === "repeticiones" &&
        s.pesoKg === semana.serie.pesoKg &&
        s.repeticiones === semana.serie.repeticiones,
    )
  return encontrada?.tipoMedicion === "repeticiones" ? encontrada : semana.serie
}

export function semanasDeFuerza(
  puntos: ProgresionFuerza["ejercicios"][number]["puntos"],
  historial: SesionDelEjercicio[] = [],
): SemanaDeFuerza[] {
  const sesiones: SesionDeProgresion[] = puntos.map((p, i) => ({
    fecha: p.fecha,
    series: [
      {
        serieId: String(i),
        tipoMedicion: "repeticiones" as const,
        hecha: true,
        pesoKg: p.pesoKg,
        repeticiones: p.repeticiones,
      },
    ],
  }))
  sesiones.push(...historial)
  return [...new Set(sesiones.map((p) => lunesDeSemana(p.fecha)))].sort().flatMap((semana) => {
    const serie = mejorSerieDeSemana(sesiones, semana)
    const sesion = serie && sesiones.find((s) => s.series.includes(serie))
    return sesion && serie
      ? [{ semana, fecha: sesion.fecha, serie, estimado: estimar1RM(serie)! }]
      : []
  })
}

export function pautaDelEjercicio(e: EjercicioPrescrito): string {
  return [
    `${e.series.length} × ${[...new Set(e.series.map(objetivoDeSerie))].join(" / ")}`,
    textoRir(e.rir),
  ]
    .filter(Boolean)
    .join(" · ")
}

export function serieLegible(serie: SerieRegistrada): string {
  if (!serie.hecha) return serie.omitida ? "Omitida" : "Sin hacer"
  const cantidad =
    serie.tipoMedicion === "repeticiones"
      ? serie.repeticiones
      : serie.tipoMedicion === "tiempo"
        ? `${serie.segundos} s`
        : `${serie.metros} m`
  return `${serie.pesoKg === null ? "" : `${decimal(serie.pesoKg)} × `}${cantidad}`
}

export const decimal = (n: number): string => String(n).replace(".", ",")
