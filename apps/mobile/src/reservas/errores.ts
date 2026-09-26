import type { Reserva } from "@alpha-omega/shared"

import { ErrorDeConflictoAgenda, ErrorDePeticion } from "../lib/http"

/** El `codigo` de un 400/409 del contrato, o null si el fallo es de otro tipo. */
export function codigoDe(error: unknown): string | null {
  if (error instanceof ErrorDePeticion) return error.detalle.codigo
  if (error instanceof ErrorDeConflictoAgenda) return error.conflicto.codigo
  return null
}

/** Las reservas que un cambio de horario o un cierre dejaría fuera, si es ese 409. */
export function conflictosDe(error: unknown): Reserva[] | null {
  return error instanceof ErrorDeConflictoAgenda ? error.conflicto.conflictos : null
}
