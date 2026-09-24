import type { Medida } from "@alpha-omega/shared"

import { masaLibre } from "./modelo"

type Toma = Pick<Medida, "id" | "fecha" | "creadoEn" | "pesoKg" | "grasaPct" | "alturaCm">

/** Un valor con la toma de la que procede. */
export type ValorDeToma = { valor: number; fecha: string; medidaId: string }

export type PuntoDePartida = {
  /** Primera toma con peso, grasa o altura: fecha el bloque «Inicio». */
  toma: { medidaId: string; fecha: string }
  /** Primer valor registrado de cada dato; puede venir de una toma posterior. */
  peso: ValorDeToma | null
  grasa: ValorDeToma | null
  altura: ValorDeToma | null
  /** Solo cuando peso y grasa proceden de la misma toma; nunca mezcla fechas. */
  masaLibre: ValorDeToma | null
}

/** Orden de las tomas: fecha, creación e identificador, sin depender del orden recibido. */
function anterior(a: Toma, b: Toma): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  if (a.creadoEn !== b.creadoEn) return a.creadoEn < b.creadoEn ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Punto de partida del cliente. Cada dato conserva la fecha y el id de su
 * toma; lo que ninguna toma contiene queda ausente, sin ceros ni rellenos.
 */
export function puntoDePartida(medidas: readonly Toma[]): PuntoDePartida | null {
  const ordenadas = [...medidas].sort(anterior)
  const primero = (clave: "pesoKg" | "grasaPct" | "alturaCm"): ValorDeToma | null => {
    const toma = ordenadas.find((m) => m[clave] !== null)
    return toma ? { valor: toma[clave]!, fecha: toma.fecha, medidaId: toma.id } : null
  }
  const inicial = ordenadas.find(
    (m) => m.pesoKg !== null || m.grasaPct !== null || m.alturaCm !== null,
  )
  if (!inicial) return null
  const peso = primero("pesoKg")
  const grasa = primero("grasaPct")
  return {
    toma: { medidaId: inicial.id, fecha: inicial.fecha },
    peso,
    grasa,
    altura: primero("alturaCm"),
    masaLibre:
      peso && grasa && peso.medidaId === grasa.medidaId
        ? { valor: masaLibre(peso.valor, grasa.valor), fecha: peso.fecha, medidaId: peso.medidaId }
        : null,
  }
}
