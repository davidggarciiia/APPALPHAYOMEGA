import {
  ResultadoEntrenamientoSchema,
  type Prescripcion,
  type Registro,
  type ResultadoEntrenamiento,
  type ResultadoSerie,
} from "@alpha-omega/shared"

/**
 * Convierte el registro enviado en el resultado publicado.
 *
 * Recorre la prescripción, no el registro: cada serie prevista aparece una vez,
 * en su orden. Una serie sin marcar sale como no realizada y SIN sus valores,
 * aunque el cliente hubiera escrito algo en ella; un objetivo nunca se copia
 * como si se hubiera hecho.
 */
export function construirResultado(
  sesionId: string,
  prescripcion: Prescripcion,
  revisionPrescripcion: number,
  registro: Registro,
  enviadoEn: Date,
): ResultadoEntrenamiento {
  const registradas = new Map(registro.series.map((serie) => [serie.serieId, serie]))
  const series: ResultadoSerie[] = prescripcion.ejercicios.flatMap((ejercicio) =>
    ejercicio.series.map((prevista): ResultadoSerie => {
      const hecha = registradas.get(prevista.id)
      if (hecha === undefined || !hecha.hecha) {
        return { serieId: prevista.id, hecha: false }
      }
      if (hecha.tipoMedicion === "repeticiones" && hecha.repeticiones !== null) {
        return {
          serieId: prevista.id,
          hecha: true,
          valores: {
            tipoMedicion: "repeticiones",
            pesoKg: hecha.pesoKg,
            repeticiones: hecha.repeticiones,
          },
        }
      }
      if (hecha.tipoMedicion === "tiempo" && hecha.segundos !== null) {
        return {
          serieId: prevista.id,
          hecha: true,
          valores: { tipoMedicion: "tiempo", pesoKg: hecha.pesoKg, segundos: hecha.segundos },
        }
      }
      return { serieId: prevista.id, hecha: false }
    }),
  )
  return ResultadoEntrenamientoSchema.parse({
    sesionId,
    prescripcion,
    revisionPrescripcion,
    enviadoEn: enviadoEn.toISOString(),
    notas: registro.notas,
    series,
  })
}
