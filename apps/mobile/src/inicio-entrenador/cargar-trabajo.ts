import type { ListadoUsuarios } from "@alpha-omega/shared"

import { listarUsuarios } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

export const ACTIVACIONES_POR_PAGINA = 8

export type TrabajoEntrenador = {
  pendientes: ListadoUsuarios
}

/**
 * Lo que el resumen semanal no trae: las altas que aún esperan activación.
 *
 * Los clientes activos sin plan ya no se comprueban aquí uno a uno: el resumen
 * semanal, que llega para toda la cartera en una sola petición, dice cuántas
 * sesiones tiene prevista cada cliente esta semana, y sin ninguna no hay plan.
 */
export async function cargarTrabajo(
  pedir: PeticionAutenticada,
  desdePendientes: number,
): Promise<TrabajoEntrenador> {
  const pendientes = await listarUsuarios(pedir, {
    rol: "cliente",
    estado: "pendiente",
    limite: ACTIVACIONES_POR_PAGINA,
    desde: desdePendientes,
  })
  return {
    pendientes: { ...pendientes, usuarios: pendientes.usuarios.slice(0, ACTIVACIONES_POR_PAGINA) },
  }
}
