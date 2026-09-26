import {
  ListadoCambiosDeFechaSchema,
  ListadoPlanesSchema,
  ListadoRutinasSchema,
  ListadoSesionesSchema,
  PanelSemanalSchema,
  PlanAsignadoSchema,
  ResultadoAnulacionSchema,
  RutinaGuardadaSchema,
  SesionEntrenadorSchema,
  type AsignarPlan,
  type CambiarPrescripcion,
  type EditarRutina,
  type GuardarRutina,
  type ListadoCambiosDeFecha,
  type ListadoPlanes,
  type ListadoRutinas,
  type ListadoSesiones,
  type PanelSemanal,
  type PlanAsignado,
  type ResultadoAnulacion,
  type RutinaGuardada,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import { pedirConSesion } from "../lib/transporte"

/*
 * Lo que el entrenador pide de entrenamiento. Nunca llega nada del borrador del
 * cliente: el servidor no lo manda y estos esquemas estrictos lo rechazarían.
 */

/** La semana de todos los clientes, o de uno si se pasa `clienteId`. */
export async function leerPanel(semana: string, clienteId?: string): Promise<PanelSemanal> {
  const consulta = new URLSearchParams({ semana })
  if (clienteId !== undefined) consulta.set("clienteId", clienteId)
  return PanelSemanalSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones?${consulta.toString()}`),
  )
}

/** Varias semanas seguidas de un cliente, para avisar de choques al asignar. */
export async function sesionesDeCliente(
  clienteId: string,
  semana: string,
  semanas: number,
): Promise<ListadoSesiones> {
  const consulta = new URLSearchParams({ semana, semanas: String(semanas) })
  return ListadoSesionesSchema.parse(
    await pedirConSesion(`/entrenamiento/clientes/${clienteId}/sesiones?${consulta.toString()}`),
  )
}

export async function leerSesionEntrenador(id: string): Promise<SesionEntrenador> {
  return SesionEntrenadorSchema.parse(await pedirConSesion(`/entrenamiento/sesiones/${id}`))
}

export async function leerCambiosDeFecha(id: string): Promise<ListadoCambiosDeFecha> {
  return ListadoCambiosDeFechaSchema.parse(await pedirConSesion(`/agenda/sesiones/${id}/cambios`))
}

export async function ajustarPrescripcion(
  id: string,
  cambio: CambiarPrescripcion,
): Promise<SesionEntrenador> {
  return SesionEntrenadorSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones/${id}/prescripcion`, {
      method: "PATCH",
      body: JSON.stringify(cambio),
    }),
  )
}

export async function anularSesion(id: string): Promise<void> {
  await pedirConSesion(`/entrenamiento/sesiones/${id}`, { method: "DELETE" })
}

export async function asignarPlan(clienteId: string, plan: AsignarPlan): Promise<PlanAsignado> {
  return PlanAsignadoSchema.parse(
    await pedirConSesion(`/entrenamiento/clientes/${clienteId}/planes`, {
      method: "POST",
      body: JSON.stringify(plan),
    }),
  )
}

export async function planesDeCliente(clienteId: string): Promise<ListadoPlanes> {
  return ListadoPlanesSchema.parse(
    await pedirConSesion(`/entrenamiento/clientes/${clienteId}/planes`),
  )
}

export async function anularPlan(id: string): Promise<ResultadoAnulacion> {
  return ResultadoAnulacionSchema.parse(
    await pedirConSesion(`/entrenamiento/planes/${id}/anular`, { method: "POST" }),
  )
}

export async function listarRutinas(): Promise<ListadoRutinas> {
  return ListadoRutinasSchema.parse(await pedirConSesion("/entrenamiento/rutinas"))
}

export async function leerRutina(id: string): Promise<RutinaGuardada> {
  return RutinaGuardadaSchema.parse(await pedirConSesion(`/entrenamiento/rutinas/${id}`))
}

export async function crearRutina(datos: GuardarRutina): Promise<RutinaGuardada> {
  return RutinaGuardadaSchema.parse(
    await pedirConSesion("/entrenamiento/rutinas", {
      method: "POST",
      body: JSON.stringify(datos),
    }),
  )
}

export async function editarRutina(id: string, datos: EditarRutina): Promise<RutinaGuardada> {
  return RutinaGuardadaSchema.parse(
    await pedirConSesion(`/entrenamiento/rutinas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(datos),
    }),
  )
}
