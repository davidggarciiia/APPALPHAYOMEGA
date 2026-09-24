import type { EdicionRegistro } from "../registro-modelo"

/** Un tramo abierto continúa mientras el móvil está bloqueado o hay otra app delante. */
export function iniciarTramo(edicion: EdicionRegistro, instante: string): EdicionRegistro {
  if (edicion.tramoActivoDesde) return edicion
  return {
    ...edicion,
    inicio: edicion.inicio ?? instante,
    tiempoActivoSegundos: edicion.tiempoActivoSegundos ?? 0,
    tramoActivoDesde: instante,
  }
}

/** Se usa al abandonar la pantalla del entrenamiento, no al cambiar AppState. */
export function pausarTramo(edicion: EdicionRegistro, instante: string): EdicionRegistro {
  if (!edicion.tramoActivoDesde) return edicion
  const tramo = Math.max(
    0,
    Math.floor((Date.parse(instante) - Date.parse(edicion.tramoActivoDesde)) / 1000),
  )
  return {
    ...edicion,
    tiempoActivoSegundos: (edicion.tiempoActivoSegundos ?? 0) + tramo,
    tramoActivoDesde: null,
  }
}

export function duracionDeSesion(
  edicion: EdicionRegistro,
  ahora: number,
): { segundos: number | null; legado: boolean } {
  if (edicion.tiempoActivoSegundos !== undefined) {
    const tramo = edicion.tramoActivoDesde
      ? Math.max(0, Math.floor((ahora - Date.parse(edicion.tramoActivoDesde)) / 1000))
      : 0
    return { segundos: edicion.tiempoActivoSegundos + tramo, legado: false }
  }
  return {
    segundos: edicion.inicio
      ? Math.max(0, Math.floor((ahora - Date.parse(edicion.inicio)) / 1000))
      : null,
    legado: edicion.inicio != null,
  }
}
