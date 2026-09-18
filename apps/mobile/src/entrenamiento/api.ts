import {
  AsignarPlanSchema,
  ListadoSesionesSchema,
  PlanAsignadoSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
  type AsignarPlan,
  type PlanAsignado,
  type ListadoSesiones,
  type SesionCliente,
  type SesionEntrenador,
} from "@alpha-omega/shared"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"

export type ApiEntrenamiento = {
  asignar: (clienteId: string, datos: AsignarPlan) => Promise<PlanAsignado>
  semana: (clienteId: string, semana: string, signal?: AbortSignal) => Promise<ListadoSesiones>
  leerCliente: (id: string) => Promise<SesionCliente>
  leerEntrenador: (id: string) => Promise<SesionEntrenador>
}

export function crearApiEntrenamiento(pedir: PeticionAutenticada): ApiEntrenamiento {
  return {
    asignar: (clienteId: string, datos: AsignarPlan) =>
      pedir(`/entrenamiento/clientes/${encodeURIComponent(clienteId)}/planes`, PlanAsignadoSchema, {
        method: "POST",
        body: JSON.stringify(AsignarPlanSchema.parse(datos)),
      }),
    semana: (clienteId: string, semana: string, signal?: AbortSignal) =>
      pedir(
        `/entrenamiento/clientes/${encodeURIComponent(clienteId)}/sesiones?semana=${encodeURIComponent(semana)}`,
        ListadoSesionesSchema,
        { signal },
      ),
    leerCliente: (id: string) =>
      pedir(`/entrenamiento/sesiones/${encodeURIComponent(id)}`, SesionClienteSchema),
    leerEntrenador: (id: string) =>
      pedir(`/entrenamiento/sesiones/${encodeURIComponent(id)}`, SesionEntrenadorSchema),
  }
}
