import type { Medida, PruebaFisica } from "@alpha-omega/shared"

/**
 * Histórico completo de medidas y pruebas. La API lo entrega por páginas, de lo
 * más reciente a lo más antiguo; aquí se reúnen todas para que Inicio y
 * Progreso sigan recibiendo el formato y el orden de siempre.
 */

/** El máximo que admite la API por página: menos peticiones con históricos largos. */
export const LIMITE_PAGINA = 500

/** Falta alguna página: una parte del histórico nunca se entrega como si fuera todo. */
export class HistoricoIncompleto extends Error {}

/**
 * Pide páginas hasta que la API indica que no quedan. Un fallo en cualquiera
 * rechaza el conjunto. Un cursor repetido o una página vacía que anuncia más
 * son un error: seguir sería repetir peticiones sin avanzar.
 * Devuelve las filas sin duplicados, en `orden`, y la primera página para los
 * datos que no son filas.
 */
export async function historicoCompleto<
  P extends { siguienteCursor: string | null },
  F extends { id: string },
>(
  pedirPagina: (cursor: string | undefined) => Promise<P>,
  filasDe: (pagina: P) => readonly F[],
  orden: (a: F, b: F) => number,
): Promise<{ primera: P; filas: F[] }> {
  const porId = new Map<string, F>()
  const cursores = new Set<string>()
  const primera = await pedirPagina(undefined)
  let pagina = primera
  for (;;) {
    const filas = filasDe(pagina)
    // Si una fila se repitiera, gana la de la página más reciente.
    for (const fila of filas) if (!porId.has(fila.id)) porId.set(fila.id, fila)
    const siguiente = pagina.siguienteCursor
    if (siguiente === null) break
    if (filas.length === 0 || cursores.has(siguiente))
      throw new HistoricoIncompleto("No se pudo leer el histórico completo. Vuelve a intentarlo.")
    cursores.add(siguiente)
    pagina = await pedirPagina(siguiente)
  }
  return { primera, filas: [...porId.values()].sort(orden) }
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
const creacion = (a: { creadoEn: string }, b: { creadoEn: string }): number =>
  Date.parse(a.creadoEn) - Date.parse(b.creadoEn)

/** Como la ruta anterior: de la toma más antigua a la más reciente; empates por creación e ID. */
export function ordenMedidas(a: Medida, b: Medida): number {
  return comparar(a.fecha, b.fecha) || creacion(a, b) || comparar(a.id, b.id)
}

/** Como la ruta anterior: por nombre y, dentro de cada uno, de la más antigua a la más reciente. */
export function ordenPruebas(a: PruebaFisica, b: PruebaFisica): number {
  return (
    comparar(a.nombre, b.nombre) ||
    comparar(a.fecha, b.fecha) ||
    creacion(a, b) ||
    comparar(a.id, b.id)
  )
}
