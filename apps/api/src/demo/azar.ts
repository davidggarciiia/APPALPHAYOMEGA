/**
 * Azar con semilla (mulberry32) para que cada sembrado produzca los mismos
 * datos: dos ejecuciones el mismo día dejan la demo idéntica.
 */
export class Azar {
  private estado: number

  constructor(semilla: number) {
    this.estado = semilla >>> 0
  }

  /** Número en [0, 1). */
  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0
    let t = this.estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  entre(minimo: number, maximo: number): number {
    return minimo + (maximo - minimo) * this.siguiente()
  }

  entero(minimo: number, maximo: number): number {
    return Math.floor(this.entre(minimo, maximo + 1))
  }

  /** Ruido simétrico de ± `amplitud`. */
  ruido(amplitud: number): number {
    return this.entre(-amplitud, amplitud)
  }

  probabilidad(p: number): boolean {
    return this.siguiente() < p
  }

  elegir<T>(lista: readonly T[]): T {
    const elegido = lista[Math.floor(this.siguiente() * lista.length)]
    if (elegido === undefined) throw new Error("No se puede elegir en una lista vacía")
    return elegido
  }
}

/** Redondea a un decimal, como guardan peso, cintura y grasa. */
export function unDecimal(valor: number): number {
  return Math.round(valor * 10) / 10
}

/** Redondea a múltiplos de `paso` (2,5 kg en barra, 1 kg en mancuerna…). */
export function redondearA(valor: number, paso: number): number {
  return Math.round(valor / paso) * paso
}
