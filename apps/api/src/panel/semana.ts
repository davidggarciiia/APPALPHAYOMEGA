import { MAXIMO_MENOR_ADHERENCIA, type PanelHoy } from "@alpha-omega/shared"

/** Un cliente con sesiones esta semana, tal como sale de la consulta agregada. */
export type SemanaDeCliente = {
  cliente: { id: string; nombre: string }
  /** De lunes a hoy. */
  programadas: number
  enviadas: number
  /** De mañana al domingo. */
  restantes: number
}

/**
 * Hacia abajo: 199 de 200 es un 99 %, nunca un 100 % que esconda la que falta.
 * Sin nada programado no hay adherencia que medir.
 */
export function porcentaje(enviadas: number, programadas: number): number | null {
  return programadas === 0 ? null : Math.floor((enviadas / programadas) * 100)
}

/**
 * Totales de la semana y los clientes que más se han descolgado: primero el
 * porcentaje más bajo; a igual porcentaje, quien más sesiones ha dejado sin
 * enviar; después, por nombre. Quien lo ha enviado todo no está en la lista.
 */
export function resumirSemana(
  filas: SemanaDeCliente[],
  lunes: string,
  domingo: string,
): PanelHoy["semana"] {
  const programadas = filas.reduce((suma, fila) => suma + fila.programadas, 0)
  const enviadas = filas.reduce((suma, fila) => suma + fila.enviadas, 0)
  const menorAdherencia = filas
    .filter((fila) => fila.programadas > 0 && fila.enviadas < fila.programadas)
    .map((fila) => ({
      cliente: fila.cliente,
      programadas: fila.programadas,
      enviadas: fila.enviadas,
      adherencia: porcentaje(fila.enviadas, fila.programadas) ?? 0,
    }))
    .sort(
      (a, b) =>
        a.adherencia - b.adherencia ||
        b.programadas - b.enviadas - (a.programadas - a.enviadas) ||
        a.cliente.nombre.localeCompare(b.cliente.nombre, "es") ||
        a.cliente.id.localeCompare(b.cliente.id),
    )
    .slice(0, MAXIMO_MENOR_ADHERENCIA)
  return {
    lunes,
    domingo,
    programadas,
    enviadas,
    adherencia: porcentaje(enviadas, programadas),
    restantes: filas.reduce((suma, fila) => suma + fila.restantes, 0),
    menorAdherencia,
  }
}
