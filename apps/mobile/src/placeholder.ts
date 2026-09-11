import { esRol, type EstadoUsuario } from "@alpha-omega/shared"

/**
 * Provisional. La tarea 4 sustituye esto por la app Expo de verdad.
 * Existe solo para demostrar que el paquete compartido se importa sin error.
 */
export function puedeIniciarSesion(estado: EstadoUsuario): boolean {
  return estado === "activo"
}

export { esRol }
