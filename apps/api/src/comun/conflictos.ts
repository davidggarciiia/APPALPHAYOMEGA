import { ConflictException } from "@nestjs/common"
import type { CodigoDeError } from "@alpha-omega/shared"
import { Prisma } from "@prisma/client"

/**
 * Un 409 con código. La app decide por el código y enseña el mensaje.
 */
export function conflicto(
  codigo: CodigoDeError,
  mensaje: string,
  extra: Record<string, unknown> = {},
): ConflictException {
  return new ConflictException({ codigo, mensaje, ...extra })
}

/**
 * Se lanza dentro de una transacción cuando una escritura condicional no tocó
 * ninguna fila. Deshace lo hecho y, fuera, se relee para decidir si era un
 * reintento (misma operación ya confirmada) o un conflicto real.
 */
export class CarreraPerdida extends Error {}

/** P2002: otra petición insertó la misma clave única primero. */
export function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}
