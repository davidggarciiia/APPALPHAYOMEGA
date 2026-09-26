import type { FilaDeSemana } from "./use-semana"

export type Destacado =
  | { tipo: "hoy"; fila: FilaDeSemana }
  | { tipo: "hecho"; fila: FilaDeSemana; atrasadas: number }
  | { tipo: "proximo"; fila: FilaDeSemana }
  | { tipo: "descanso"; atrasadas: number }

/** Lo que va en la tarjeta grande: lo de hoy, o lo siguiente, o descanso. */
export function destacadoDe(filas: FilaDeSemana[], hoy: string): Destacado {
  const deHoy = filas.filter((f) => f.agenda.fechaActual === hoy)
  const porHacer = deHoy.find((f) => f.enviadoEn === null)
  if (porHacer !== undefined) {
    return { tipo: "hoy", fila: porHacer }
  }
  // Lo de días pasados que sigue abierto: aún se puede registrar y enviar.
  const atrasadas = filas.filter(
    (f) => f.enviadoEn === null && f.agenda.fechaActual < hoy && f.agenda.estado === "abierta",
  ).length
  // Si hoy ya está hecho, eso es lo que se enseña: lo siguiente se ve en la tira.
  if (deHoy[0] !== undefined) {
    return { tipo: "hecho", fila: deHoy[0], atrasadas }
  }
  const proximo = filas.find((f) => f.enviadoEn === null && f.agenda.fechaActual > hoy)
  return proximo === undefined
    ? { tipo: "descanso", atrasadas }
    : { tipo: "proximo", fila: proximo }
}
