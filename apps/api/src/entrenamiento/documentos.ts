import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common"
import { createHash } from "node:crypto"
import { Prisma } from "@prisma/client"
import {
  PrescripcionSchema,
  type EjercicioEnRutina,
  type Prescripcion,
  type ErrorDeApi,
} from "@alpha-omega/shared"
import type { z } from "zod"

export function conflicto(
  codigo: Extract<ErrorDeApi, { statusCode: 409 }>["codigo"],
  message: string,
): ConflictException {
  return new ConflictException({ statusCode: 409, codigo, message })
}

export function invalida(message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, codigo: "solicitud_invalida", message })
}

/** La versión de la fila gobierna todos sus documentos, también las respuestas de replay. */
export function leerDocumento<T>(valor: unknown, esquema: z.ZodType<T>, version: number): T {
  const resultado = esquema.safeParse(valor)
  if (version !== 1 || !resultado.success)
    throw new InternalServerErrorException("No se puede leer el documento de entrenamiento")
  return resultado.data
}

/** Los consumidores pasan objetos ya normalizados por los esquemas Zod, con orden estable. */
export function hashPeticion(valor: unknown): string {
  return createHash("sha256").update(JSON.stringify(valor)).digest("hex")
}

export async function catalogoParaPrescribir(
  tx: Prisma.TransactionClient,
  ejercicios: EjercicioEnRutina[],
): Promise<Map<string, string>> {
  const ids = [...new Set(ejercicios.map((ejercicio) => ejercicio.ejercicioId))].sort()
  const filas = await tx.$queryRaw<
    Array<{ id: string; nombre: string; estado: string }>
  >(Prisma.sql`
    SELECT "id", "nombre", "estado" FROM "ejercicios"
    WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR SHARE
  `)
  if (filas.length !== ids.length || filas.some((fila) => fila.estado !== "publicado")) {
    throw invalida("Elige ejercicios publicados antes de asignar la rutina")
  }
  return new Map(filas.map((fila) => [fila.id, fila.nombre]))
}

export function prescripcionConNombres(
  sesion: Pick<Prescripcion, "nombre" | "duracion" | "nota" | "partes" | "circuito"> & {
    ejercicios: EjercicioEnRutina[]
  },
  nombres: Map<string, string>,
): Prescripcion {
  return PrescripcionSchema.parse({
    nombre: sesion.nombre,
    // Los datos de la sesión del diseño viajan con ella; los ausentes, ausentes.
    duracion: sesion.duracion,
    nota: sesion.nota,
    partes: sesion.partes,
    circuito: sesion.circuito,
    ejercicios: sesion.ejercicios.map((ejercicio) => ({
      ...ejercicio,
      nombre: nombres.get(ejercicio.ejercicioId),
    })),
  })
}
