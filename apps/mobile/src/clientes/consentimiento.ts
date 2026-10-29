import type { EstadoConsentimiento } from "@alpha-omega/shared"
import { fechaLegible } from "../entrenamiento/fechas"

export function textoConsentimiento(estado: EstadoConsentimiento | null): string {
  if (estado === null) return "No se pudo comprobar"
  if (estado.vigente && estado.aceptadoEn)
    return `Dado el ${fechaLegible(estado.aceptadoEn.slice(0, 10))}`
  if (estado.retiradoEn) return `Retirado el ${fechaLegible(estado.retiradoEn.slice(0, 10))}`
  return estado.version ? "Pendiente de la versión nueva" : "Pendiente"
}
