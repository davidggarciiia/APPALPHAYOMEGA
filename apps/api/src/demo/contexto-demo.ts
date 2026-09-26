import { aInstante, sumarDiasFecha, ZONA_AGENDA } from "@alpha-omega/shared"
import type { NestExpressApplication } from "@nestjs/platform-express"

import type { PrismaService } from "../prisma/prisma.service.js"
import type { ApiDemo, Cuenta } from "./api-demo.js"
import type { Azar } from "./azar.js"

/** Los seis clientes de la demo. */
export type ClaveCliente = "lucia" | "marcos" | "sara" | "javier" | "nerea" | "pablo"

/** Lo que comparten todas las partes del sembrado. */
export type ContextoDemo = {
  app: NestExpressApplication
  api: ApiDemo
  prisma: PrismaService
  azar: Azar
  /** Hoy en Europe/Madrid, `AAAA-MM-DD`. Todas las fechas salen de aquí. */
  hoy: string
  entrenador: Cuenta
  nutricionista: Cuenta
  /** Javier no tiene sesión: está pendiente de activar. Su id está en `ids`. */
  clientes: Record<Exclude<ClaveCliente, "javier">, Cuenta>
  ids: Record<ClaveCliente, string>
  /** Ejercicios publicados del catálogo por nombre normalizado. */
  ejercicios: Map<string, string>
  informar: (linea: string) => void
}

/** Fecha relativa a hoy: `dia(ctx, -7)` es hace una semana. */
export function dia(ctx: Pick<ContextoDemo, "hoy">, desplazamiento: number): string {
  return sumarDiasFecha(ctx.hoy, desplazamiento)
}

/** El instante en que el reloj de Madrid marca esa hora de ese día. */
export function instante(fecha: string, hora: number, minuto = 0): Date {
  const valor = aInstante(fecha, hora * 60 + minuto, ZONA_AGENDA)
  // La hora que no existe en marzo: una hora después sí existe.
  return valor ?? aInstante(fecha, (hora + 1) * 60 + minuto, ZONA_AGENDA)!
}

/** Días entre dos fechas de calendario (`b` − `a`). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/** Las fechas del intervalo `[desde, hasta]` que caen en `diaSemana` (1 = lunes). */
export function fechasDeLaSemana(desde: string, hasta: string, diaSemana: number): string[] {
  const fechas: string[] = []
  for (let fecha = desde; fecha <= hasta; fecha = sumarDiasFecha(fecha, 1)) {
    const numero = ((new Date(`${fecha}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
    if (numero === diaSemana) fechas.push(fecha)
  }
  return fechas
}
