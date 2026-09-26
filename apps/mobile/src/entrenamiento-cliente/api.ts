import {
  BorradorSchema,
  ListadoEjerciciosSchema,
  ListadoSesionesSchema,
  ResultadoEntrenamientoSchema,
  SesionClienteSchema,
  SesionProgramadaSchema,
  type Borrador,
  type EnviarEntrenamiento,
  type GuardarBorrador,
  type ListadoEjercicios,
  type ListadoSesiones,
  type ResultadoEntrenamiento,
  type SesionCliente,
  type SesionProgramada,
} from "@alpha-omega/shared"

import { pedirConSesion } from "../lib/transporte"

/*
 * Llamadas del cliente a su entrenamiento. Todo lo que llega se valida con el
 * mismo esquema que usa el servidor.
 */

export async function listarSemana(
  clienteId: string,
  semana: string,
  semanas = 1,
): Promise<ListadoSesiones> {
  const consulta = new URLSearchParams({ semana, semanas: String(semanas) })
  return ListadoSesionesSchema.parse(
    await pedirConSesion(`/entrenamiento/clientes/${clienteId}/sesiones?${consulta.toString()}`),
  )
}

export async function leerSesion(id: string): Promise<SesionCliente> {
  return SesionClienteSchema.parse(await pedirConSesion(`/entrenamiento/sesiones/${id}`))
}

export async function leerEjerciciosDeSesion(id: string): Promise<ListadoEjercicios> {
  return ListadoEjerciciosSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones/${id}/ejercicios`),
  )
}

export async function guardarBorrador(id: string, cuerpo: GuardarBorrador): Promise<Borrador> {
  return BorradorSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones/${id}/borrador`, {
      method: "PUT",
      body: JSON.stringify(cuerpo),
    }),
  )
}

export async function enviarEntrenamiento(
  id: string,
  cuerpo: EnviarEntrenamiento,
): Promise<ResultadoEntrenamiento> {
  return ResultadoEntrenamientoSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones/${id}/enviar`, {
      method: "POST",
      body: JSON.stringify(cuerpo),
    }),
  )
}

export async function leerResultado(id: string): Promise<ResultadoEntrenamiento> {
  return ResultadoEntrenamientoSchema.parse(
    await pedirConSesion(`/entrenamiento/sesiones/${id}/resultado`),
  )
}

export async function cambiarFecha(
  id: string,
  fecha: string,
  revision: number,
): Promise<SesionProgramada> {
  return SesionProgramadaSchema.parse(
    await pedirConSesion(`/agenda/sesiones/${id}/fecha`, {
      method: "PATCH",
      body: JSON.stringify({ fecha, revision }),
    }),
  )
}
