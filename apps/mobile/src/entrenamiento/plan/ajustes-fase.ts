import {
  redondearCarga,
  type AjustesDeFase,
  type EjercicioPrescrito,
  type ValoresEjecutados,
} from "@alpha-omega/shared"

export const decimalDeFase = (numero: number): string => String(numero).replace(".", ",")

export function textoDeAjustes(ajustes?: AjustesDeFase): string | null {
  if (!ajustes) return null
  const rir = (rango: { min: number; max: number }): string =>
    rango.min === rango.max ? String(rango.min) : `${rango.min}–${rango.max}`
  const partes: string[] = []
  if (
    ajustes.rirCompuestos &&
    ajustes.rirAccesorios &&
    rir(ajustes.rirCompuestos) === rir(ajustes.rirAccesorios)
  )
    partes.push(`RIR ${rir(ajustes.rirCompuestos)}`)
  else {
    if (ajustes.rirCompuestos) partes.push(`RIR ${rir(ajustes.rirCompuestos)} compuestos`)
    if (ajustes.rirAccesorios) partes.push(`RIR ${rir(ajustes.rirAccesorios)} accesorios`)
  }
  if (ajustes.factorSeries !== undefined && ajustes.factorSeries < 1)
    partes.push(
      `−${decimalDeFase(Number(((1 - ajustes.factorSeries) * 100).toFixed(1)))} % series accesorios (compuestos igual)`,
    )
  if (ajustes.factorCarga !== undefined && ajustes.factorCarga !== 1)
    partes.push(`${decimalDeFase(Number((ajustes.factorCarga * 100).toFixed(1)))} % de carga`)
  return partes.length > 0 ? partes.join(" · ") : null
}

export function cargaSugeridaDeFase(
  ejercicio: EjercicioPrescrito,
  factorCarga?: number,
  anterior?: ValoresEjecutados,
): number | null {
  if (
    factorCarga === undefined ||
    factorCarga === 1 ||
    ejercicio.tipoCarga === "sinCarga" ||
    anterior?.pesoKg == null
  )
    return null
  return redondearCarga(anterior.pesoKg * factorCarga, ejercicio.subidaKg)
}
