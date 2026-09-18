import {
  AsignarPlanSchema,
  ListadoSesionesSchema,
  PlanAsignadoSchema,
  SesionClienteSchema,
  SesionEntrenadorSchema,
  BorradorSchema,
  GuardarBorradorSchema,
  EnviarEntrenamientoSchema,
  ResultadoEntrenamientoSchema,
  CambiarFechaSchema,
  SesionProgramadaSchema,
  ListadoCambiosSchema,
  CambiarPrescripcionSchema,
  type CambiarPrescripcion,
  type CambiarFecha,
  type SesionProgramada,
  type ListadoCambios,
  type GuardarBorrador,
  type EnviarEntrenamiento,
  type Borrador,
  type ResultadoEntrenamiento,
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
  guardar: (id: string, datos: GuardarBorrador) => Promise<Borrador>
  enviar: (id: string, datos: EnviarEntrenamiento) => Promise<ResultadoEntrenamiento>
  resultado: (id: string) => Promise<ResultadoEntrenamiento>
  mover: (id: string, datos: CambiarFecha) => Promise<SesionProgramada>
  cambios: (id: string, desplazamiento?: number) => Promise<ListadoCambios>
  ajustar: (id: string, datos: CambiarPrescripcion) => Promise<SesionEntrenador>
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
    guardar: (id, datos) =>
      pedir(`/entrenamiento/sesiones/${encodeURIComponent(id)}/borrador`, BorradorSchema, {
        method: "PUT",
        body: JSON.stringify(GuardarBorradorSchema.parse(datos)),
      }),
    enviar: (id, datos) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(id)}/enviar`,
        ResultadoEntrenamientoSchema,
        { method: "POST", body: JSON.stringify(EnviarEntrenamientoSchema.parse(datos)) },
      ),
    resultado: (id) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(id)}/resultado`,
        ResultadoEntrenamientoSchema,
      ),
    mover: (id, datos) =>
      pedir(`/agenda/sesiones/${encodeURIComponent(id)}/fecha`, SesionProgramadaSchema, {
        method: "PATCH",
        body: JSON.stringify(CambiarFechaSchema.parse(datos)),
      }),
    cambios: (id, desplazamiento = 0) =>
      pedir(
        `/agenda/sesiones/${encodeURIComponent(id)}/cambios?limite=30&desplazamiento=${desplazamiento}`,
        ListadoCambiosSchema,
      ),
    ajustar: (id, datos) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(id)}/prescripcion`,
        SesionEntrenadorSchema,
        { method: "PATCH", body: JSON.stringify(CambiarPrescripcionSchema.parse(datos)) },
      ),
  }
}
