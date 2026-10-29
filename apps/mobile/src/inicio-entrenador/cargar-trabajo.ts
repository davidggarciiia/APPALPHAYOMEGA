import type { ListadoUsuarios, ResumenUsuario } from "@alpha-omega/shared"

import { crearApiEntrenamiento } from "../entrenamiento/api"
import { lunesDeSemana } from "../entrenamiento/fechas"
import { listarUsuarios } from "../lib/api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

export const ACTIVOS_POR_PAGINA = 4
export const ACTIVACIONES_POR_PAGINA = 8

export type TrabajoCliente = {
  cliente: ResumenUsuario
  sinPlan: boolean
}
export type TrabajoEntrenador = {
  activos: ListadoUsuarios
  pendientes: ListadoUsuarios
  clientes: TrabajoCliente[]
}

/** Una página, sin recorrer la cartera ni el historial completo de cada cliente. */
export async function cargarTrabajo(
  pedir: PeticionAutenticada,
  desdeActivos: number,
  desdePendientes: number,
): Promise<TrabajoEntrenador> {
  const [activos, pendientes] = await Promise.all([
    listarUsuarios(pedir, {
      rol: "cliente",
      estado: "activo",
      limite: ACTIVOS_POR_PAGINA,
      desde: desdeActivos,
    }),
    listarUsuarios(pedir, {
      rol: "cliente",
      estado: "pendiente",
      limite: ACTIVACIONES_POR_PAGINA,
      desde: desdePendientes,
    }),
  ])
  const api = crearApiEntrenamiento(pedir)
  const usuarios = activos.usuarios.slice(0, ACTIVOS_POR_PAGINA)
  const lunes = lunesDeSemana()
  const clientes = await Promise.all(
    usuarios.map(async (cliente): Promise<TrabajoCliente> => {
      const plan = await api.plan(cliente.id, lunes)
      return {
        cliente,
        sinPlan: plan.plan === null,
      }
    }),
  )
  return {
    activos: { ...activos, usuarios },
    pendientes: { ...pendientes, usuarios: pendientes.usuarios.slice(0, ACTIVACIONES_POR_PAGINA) },
    clientes,
  }
}
