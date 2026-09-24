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
  ListadoAnterioresSchema,
  ListadoMolestiasSchema,
  MolestiaSchema,
  RegistrarMolestiaSchema,
  PlanVigenteRespuestaSchema,
  ListadoResultadosSchema,
  ComentarSesionSchema,
  ComentarioSesionSchema,
  ListadoComentariosSchema,
  type ListadoResultados,
  type ComentarSesion,
  type ComentarioSesion,
  type ListadoComentarios,
  PlanVigenteSchema,
  CambiarBloqueSchema,
  type CambiarBloque,
  type PlanVigente,
  type PlanVigenteRespuesta,
  type ListadoAnteriores,
  type ListadoMolestias,
  type Molestia,
  type RegistrarMolestia,
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
  /** La mejor serie de la última vez de cada ejercicio de la sesión. */
  anteriores: (id: string) => Promise<ListadoAnteriores>
  avisarMolestia: (id: string, datos: RegistrarMolestia) => Promise<Molestia>
  molestias: (
    clienteId: string,
    estado?: "abierta" | "atendida" | "todas",
  ) => Promise<ListadoMolestias>
  atenderMolestia: (id: string, respuesta: string) => Promise<Molestia>
  /** El plan que cubre la semana (su bloque, fases y notas), o null. */
  plan: (clienteId: string, semana: string) => Promise<PlanVigenteRespuesta>
  cambiarBloque: (planId: string, datos: CambiarBloque) => Promise<PlanVigente>
  /** Las últimas sesiones enviadas, con su resultado. */
  resultados: (clienteId: string, limite?: number) => Promise<ListadoResultados>
  comentar: (sesionId: string, datos: ComentarSesion) => Promise<ComentarioSesion>
  comentarios: (sesionId: string) => Promise<ListadoComentarios>
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
    anteriores: (id) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(id)}/anteriores`,
        ListadoAnterioresSchema,
      ),
    avisarMolestia: (id, datos) =>
      pedir(`/entrenamiento/sesiones/${encodeURIComponent(id)}/molestias`, MolestiaSchema, {
        method: "POST",
        body: JSON.stringify(RegistrarMolestiaSchema.parse(datos)),
      }),
    molestias: (clienteId, estado = "todas") =>
      pedir(
        `/entrenamiento/clientes/${encodeURIComponent(clienteId)}/molestias?estado=${estado}`,
        ListadoMolestiasSchema,
      ),
    atenderMolestia: (id, respuesta) =>
      pedir(`/entrenamiento/molestias/${encodeURIComponent(id)}/atender`, MolestiaSchema, {
        method: "POST",
        body: JSON.stringify({ respuesta }),
      }),
    plan: (clienteId, semana) =>
      pedir(
        `/entrenamiento/clientes/${encodeURIComponent(clienteId)}/plan?semana=${encodeURIComponent(semana)}`,
        PlanVigenteRespuestaSchema,
      ),
    cambiarBloque: (planId, datos) =>
      pedir(`/entrenamiento/planes/${encodeURIComponent(planId)}/bloque`, PlanVigenteSchema, {
        method: "PATCH",
        body: JSON.stringify(CambiarBloqueSchema.parse(datos)),
      }),
    resultados: (clienteId, limite = 20) =>
      pedir(
        `/entrenamiento/clientes/${encodeURIComponent(clienteId)}/resultados?limite=${limite}`,
        ListadoResultadosSchema,
      ),
    comentar: (sesionId, datos) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(sesionId)}/comentarios`,
        ComentarioSesionSchema,
        { method: "POST", body: JSON.stringify(ComentarSesionSchema.parse(datos)) },
      ),
    comentarios: (sesionId) =>
      pedir(
        `/entrenamiento/sesiones/${encodeURIComponent(sesionId)}/comentarios`,
        ListadoComentariosSchema,
      ),
  }
}
