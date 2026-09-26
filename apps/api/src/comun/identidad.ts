import type { IdentidadVerificada, PeticionAutenticada } from "../identity/peticion.js"

/**
 * La identidad de la petición.
 *
 * `AutenticacionGuard` es global y ya la exige; esto solo estrecha el tipo. El
 * valor de reserva no tiene acceso a nada: ningún cliente tiene id vacío.
 */
export function identidad(peticion: PeticionAutenticada): IdentidadVerificada {
  return peticion.usuario ?? { sub: "", rol: "cliente", sid: "" }
}
