import type {
  BuscarEjercicios,
  CrearEjercicio,
  EditarEjercicio,
  Ejercicio,
  ListadoEjercicios,
} from "@alpha-omega/shared"
import {
  BuscarEjerciciosSchema,
  EjercicioSchema,
  ListadoEjerciciosSchema,
} from "@alpha-omega/shared"
import { ErrorDePeticion } from "../lib/http"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

/** Filtros como los escribe la pantalla. Lo que falte lo rellena el contrato. */
export type FiltrosDeCatalogo = Partial<BuscarEjercicios>

/**
 * Ya hay otro ejercicio con ese nombre.
 *
 * Tiene clase propia porque es el único rechazo que el formulario pinta en un
 * campo concreto. El adaptador lo traduce desde la respuesta del servidor y la
 * pantalla no interpreta códigos ni textos.
 */
export class ErrorDeNombreDuplicado extends Error {}

/**
 * Lo que las pantallas del catálogo necesitan del servidor.
 *
 * Las pantallas reciben este objeto en lugar de importar las llamadas. El
 * adaptador real se construye sobre el transporte autenticado común, y las
 * pruebas usan un catálogo en memoria que cumple los mismos esquemas.
 */
export type ApiDeCatalogo = {
  buscar: (filtros: FiltrosDeCatalogo) => Promise<ListadoEjercicios>
  leer: (id: string) => Promise<Ejercicio>
  crear: (datos: CrearEjercicio) => Promise<Ejercicio>
  editar: (id: string, datos: EditarEjercicio) => Promise<Ejercicio>
  /** Retirar y reponer devuelven la ficha ya cambiada. Repetirlos no es un error. */
  retirar: (id: string) => Promise<Ejercicio>
  reponer: (id: string) => Promise<Ejercicio>
}

export function crearApiDeCatalogo(pedir: PeticionAutenticada): ApiDeCatalogo {
  async function escribir(
    ruta: string,
    method: string,
    datos?: CrearEjercicio,
  ): Promise<Ejercicio> {
    try {
      return await pedir(ruta, EjercicioSchema, {
        method,
        body: datos === undefined ? undefined : JSON.stringify(datos),
      })
    } catch (error) {
      if (error instanceof ErrorDePeticion && error.detalle.codigo === "nombre_duplicado") {
        throw new ErrorDeNombreDuplicado(error.message)
      }
      throw error
    }
  }

  return {
    buscar: (filtros) => {
      const consulta = new URLSearchParams()
      for (const [clave, valor] of Object.entries(BuscarEjerciciosSchema.parse(filtros))) {
        if (valor !== undefined) consulta.set(clave, String(valor))
      }
      return pedir(`/ejercicios?${consulta.toString()}`, ListadoEjerciciosSchema)
    },
    leer: (id) => pedir(`/ejercicios/${encodeURIComponent(id)}`, EjercicioSchema),
    crear: (datos) => escribir("/ejercicios", "POST", datos),
    editar: (id, datos) => escribir(`/ejercicios/${encodeURIComponent(id)}`, "PATCH", datos),
    retirar: (id) => escribir(`/ejercicios/${encodeURIComponent(id)}/retirar`, "POST"),
    reponer: (id) => escribir(`/ejercicios/${encodeURIComponent(id)}/reponer`, "POST"),
  }
}
