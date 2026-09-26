import {
  EjercicioSchema,
  ListadoEjerciciosSchema,
  type CrearEjercicio,
  type EditarEjercicio,
  type Ejercicio,
  type GrupoMuscular,
  type ListadoEjercicios,
} from "@alpha-omega/shared"

import { pedirConSesion } from "../lib/transporte"

/*
 * El catálogo de ejercicios. Todo lo que llega se valida con el mismo esquema
 * que usa el servidor.
 */

export type FiltrosDeCatalogo = {
  buscar?: string
  grupo?: GrupoMuscular
  estado?: "publicado" | "retirado" | "todos"
  limite?: number
  desplazamiento?: number
}

export async function buscarEjercicios(
  filtros: FiltrosDeCatalogo = {},
): Promise<ListadoEjercicios> {
  const consulta = new URLSearchParams()
  if (filtros.buscar !== undefined && filtros.buscar.trim() !== "") {
    consulta.set("buscar", filtros.buscar.trim())
  }
  if (filtros.grupo !== undefined) consulta.set("grupo", filtros.grupo)
  if (filtros.estado !== undefined) consulta.set("estado", filtros.estado)
  if (filtros.limite !== undefined) consulta.set("limite", String(filtros.limite))
  if (filtros.desplazamiento !== undefined) {
    consulta.set("desplazamiento", String(filtros.desplazamiento))
  }
  const texto = consulta.toString()
  return ListadoEjerciciosSchema.parse(
    await pedirConSesion(`/ejercicios${texto === "" ? "" : `?${texto}`}`),
  )
}

/** Varios ejercicios por id, para poner nombre a los de una rutina guardada. */
export async function ejerciciosPorId(ids: string[]): Promise<ListadoEjercicios> {
  if (ids.length === 0) {
    return { ejercicios: [], total: 0 }
  }
  const consulta = new URLSearchParams({ ids: [...new Set(ids)].join(",") })
  return ListadoEjerciciosSchema.parse(
    await pedirConSesion(`/ejercicios/por-id?${consulta.toString()}`),
  )
}

export async function leerEjercicio(id: string): Promise<Ejercicio> {
  return EjercicioSchema.parse(await pedirConSesion(`/ejercicios/${id}`))
}

export async function crearEjercicio(datos: CrearEjercicio): Promise<Ejercicio> {
  return EjercicioSchema.parse(
    await pedirConSesion("/ejercicios", { method: "POST", body: JSON.stringify(datos) }),
  )
}

export async function editarEjercicio(id: string, datos: EditarEjercicio): Promise<Ejercicio> {
  return EjercicioSchema.parse(
    await pedirConSesion(`/ejercicios/${id}`, { method: "PATCH", body: JSON.stringify(datos) }),
  )
}

export async function retirarEjercicio(id: string): Promise<Ejercicio> {
  return EjercicioSchema.parse(
    await pedirConSesion(`/ejercicios/${id}/retirar`, { method: "POST" }),
  )
}

export async function reponerEjercicio(id: string): Promise<Ejercicio> {
  return EjercicioSchema.parse(
    await pedirConSesion(`/ejercicios/${id}/reponer`, { method: "POST" }),
  )
}
