import { sugerenciaDeProgresion, type SesionCliente } from "@alpha-omega/shared"
import type { ApiDeCatalogo } from "../catalogo-ejercicios/api"
import type { ApiEntrenamiento } from "./api"

/** El historial es opcional: nunca cambia las cargas escritas ni la prescripción. */
export async function cargarSugerenciasDeProgresion(
  api: Pick<ApiEntrenamiento, "resultados">,
  catalogo: Pick<ApiDeCatalogo, "leer">,
  sesion: SesionCliente,
): Promise<ReadonlyMap<string, number>> {
  if ((sesion.prescripcion.fase?.ajustes.factorCarga ?? 1) < 1) return new Map()
  const { resultados } = await api.resultados(sesion.agenda.clienteId, 60)
  const historial = resultados
    .filter(
      ({ agenda, resultado }) =>
        resultado.sesionId !== sesion.agenda.id && agenda.fechaActual <= sesion.agenda.fechaActual,
    )
    .sort(
      (a, b) =>
        b.agenda.fechaActual.localeCompare(a.agenda.fechaActual) ||
        b.resultado.enviadoEn.localeCompare(a.resultado.enviadoEn),
    )
  const ejercicios = sesion.prescripcion.ejercicios
  const sugerencias = await Promise.all(
    ejercicios.map(async (ejercicio) => {
      if (
        (ejercicio.seccion ?? "principal") !== "principal" ||
        ejercicio.tipoCarga === "sinCarga" ||
        ejercicio.calibrar ||
        ejercicio.series.some((serie) => serie.tipoMedicion !== "repeticiones") ||
        ejercicios.filter((e) => e.ejercicioId === ejercicio.ejercicioId).length !== 1
      )
        return null
      const ultima = historial.find(({ resultado }) =>
        resultado.prescripcion.ejercicios.some((e) => e.ejercicioId === ejercicio.ejercicioId),
      )
      const anteriores = ultima?.resultado.prescripcion.ejercicios.filter(
        (e) => e.ejercicioId === ejercicio.ejercicioId,
      )
      if (!ultima || anteriores?.length !== 1) return null
      const anterior = anteriores[0]!
      const series = ultima.resultado.series.flatMap((serie) =>
        serie.hecha ? [{ ...serie.valores, serieId: serie.serieId, hecha: true }] : [],
      )
      const grupo =
        ejercicio.subidaKg === undefined
          ? await catalogo.leer(ejercicio.ejercicioId).then(
              (ficha) => ficha.grupoPrincipal,
              () => undefined,
            )
          : undefined
      const sugerencia = sugerenciaDeProgresion(
        { ...anterior, subidaKg: ejercicio.subidaKg },
        series,
        grupo,
      )
      return sugerencia ? ([ejercicio.id, sugerencia.incrementoKg] as const) : null
    }),
  )
  return new Map(sugerencias.filter((entrada) => entrada !== null))
}
