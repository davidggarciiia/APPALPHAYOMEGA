/**
 * Paso entre la fecha de la agenda (AAAA-MM-DD) y la columna `date` de Postgres.
 *
 * Prisma representa un `date` como la medianoche UTC de ese día, y el adaptador
 * de pg lo escribe con los componentes UTC. Cualquier otra forma de construir la
 * fecha (medianoche local, `new Date(año, mes, día)`) la mueve un día según la
 * zona del servidor.
 */
export function aFechaBD(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`)
}

export function deFechaBD(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}
