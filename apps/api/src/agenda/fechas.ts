import { SesionProgramadaSchema, type SesionProgramada } from "@alpha-omega/shared"
import type { SesionProgramada as FilaAgenda } from "@prisma/client"

export function fechaSql(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`)
}

export function sumarDias(fecha: string, dias: number): string {
  const resultado = fechaSql(fecha)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado.toISOString().slice(0, 10)
}

export function lunesDeSemana(fecha: string): string {
  return sumarDias(fecha, -((fechaSql(fecha).getUTCDay() + 6) % 7))
}

export function agendaPublica(fila: FilaAgenda): SesionProgramada {
  return SesionProgramadaSchema.parse({
    id: fila.id,
    clienteId: fila.clienteId,
    fechaOriginal: fila.fechaOriginal.toISOString().slice(0, 10),
    fechaActual: fila.fechaActual.toISOString().slice(0, 10),
    estado: fila.estado,
    revision: fila.revision,
  })
}
