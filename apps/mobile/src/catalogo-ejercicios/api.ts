import type { BuscarEjercicios, ListadoEjercicios } from "@alpha-omega/shared"

/** Filtros como los escribe la pantalla. Lo que falte lo rellena el contrato. */
export type FiltrosDeCatalogo = Partial<BuscarEjercicios>

/**
 * Lo que las pantallas del catálogo necesitan del servidor.
 *
 * Las pantallas reciben este objeto en lugar de importar las llamadas. El
 * adaptador real se construye sobre el transporte autenticado común, y las
 * pruebas usan un catálogo en memoria que cumple los mismos esquemas.
 */
export type ApiDeCatalogo = {
  buscar: (filtros: FiltrosDeCatalogo) => Promise<ListadoEjercicios>
}
