import { normalizarNombreEjercicio } from "@alpha-omega/shared"

/*
 * Qué ejercicios tienen figura.
 *
 * De momento hay una, la del press banca del export de Claude Design, como
 * muestra. El catálogo todavía no guarda figuras (la ficha las expone como
 * ausentes), así que se reconoce por el nombre.
 */
export type IdDeFigura = "press-banca"

export function figuraPara(nombre: string): IdDeFigura | null {
  const texto = normalizarNombreEjercicio(nombre)
  if (/press.*(banca|banco)|bench press/.test(texto) && !/inclinad/.test(texto)) {
    return "press-banca"
  }
  return null
}
